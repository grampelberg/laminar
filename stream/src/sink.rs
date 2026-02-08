use std::{future, sync::Arc, time::Duration};

use eyre::Result;
use iroh::{
    Endpoint, EndpointAddr, EndpointId,
    endpoint::{
        ConnectError, ConnectWithOptsError, Connection, ConnectionError,
        RecvStream, SendStream,
    },
    protocol::{AcceptError, ProtocolHandler},
};
use n0_error::Location;
use serde::Serialize;
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    sync::{broadcast, mpsc},
    time::{self, error::Elapsed},
};
use tracing::Instrument;

use crate::api;

const MAX_RECORD_BYTES: usize = 1024 * 1024;

pub const ALPN: &[u8] = b"inspector/sink/0";

type BoxError = Box<dyn std::error::Error + Send + Sync>;

trait RecvSink {
    async fn receive_request<T>(&mut self) -> Result<Option<T>, BoxError>
    where
        T: serde::de::DeserializeOwned;
}

impl RecvSink for RecvStream {
    async fn receive_request<T>(&mut self) -> Result<Option<T>, BoxError>
    where
        T: serde::de::DeserializeOwned,
    {
        let Ok(frame) = self.read_u16().await else {
            return Ok(None);
        };

        let mut buf = vec![0u8; frame as usize];
        self.read_exact(&mut buf).await?;

        Ok(Some(postcard::from_bytes(&buf)?))
    }
}

// On the receiver side, it would be more efficient to fetch/store the process
// information separately from the rest of the response. That, however, would
// probably require an eum and different messages. It is probably the correct
// direction, there's going to need to be some kind of authentication here
// eventually.
#[derive(Debug, bon::Builder)]
pub struct Response<Assertion, Body> {
    pub identity: Identity<Assertion>,

    #[builder(default = api::now())]
    pub received_at: i64,
    pub body: Body,
}

#[derive(Clone, Debug)]
pub struct Identity<T> {
    pub observed: EndpointId,
    pub assertion: T,
}

#[derive(bon::Builder)]
pub struct SinkOpts {
    #[builder(default = 10)]
    buffer_size: usize,
}

impl Default for SinkOpts {
    fn default() -> Self {
        Self::builder().build()
    }
}

pub struct Sink<Assertion, Body> {
    handler: SinkHandler<Assertion, Body>,
    receiver: mpsc::Receiver<Response<Assertion, Body>>,
}

impl<Assertion, Body> Sink<Assertion, Body> {
    pub fn build() -> Self {
        Self::build_with_opts(SinkOpts::default())
    }

    pub fn build_with_opts(opts: SinkOpts) -> Self {
        let (tx, rx) = mpsc::channel(opts.buffer_size);

        Self {
            handler: SinkHandler { emit: tx },
            receiver: rx,
        }
    }

    pub fn split(
        self,
    ) -> (
        SinkHandler<Assertion, Body>,
        mpsc::Receiver<Response<Assertion, Body>>,
    ) {
        (self.handler, self.receiver)
    }
}

#[derive(Debug)]
pub struct SinkHandler<Assertion, Body> {
    emit: mpsc::Sender<Response<Assertion, Body>>,
}

impl<Assertion, Body> ProtocolHandler for SinkHandler<Assertion, Body>
where
    Assertion: serde::de::DeserializeOwned
        + Clone
        + std::fmt::Debug
        + Send
        + Sync
        + 'static,
    Body: serde::de::DeserializeOwned + std::fmt::Debug + Send + Sync + 'static,
{
    async fn accept(&self, connection: Connection) -> Result<(), AcceptError> {
        metrics::counter!("sink.accept_connection").increment(1);
        let peer = connection.remote_id();

        // 1. Open a single unidirection stream to push everything over
        //    (framed).
        // 2. First frame is the process information.
        // 3. Subsequent frames are messages.
        while let Some(mut stream) = connection
            .accept_uni()
            .in_current_span()
            .await
            .map(Some)
            .or_else(|e| {
                if connection.close_reason().is_some() {
                    Ok(None)
                } else {
                    Err(AcceptError::from_err(e))
                }
            })?
        {
            metrics::counter!("sink.accept_stream").increment(1);

            let Some(connection_id): Option<Assertion> = stream
                .receive_request()
                .in_current_span()
                .await
                .map_err(AcceptError::from_boxed)?
            else {
                continue;
            };

            while let Some(req) = stream
                .receive_request()
                .in_current_span()
                .await
                .map_err(AcceptError::from_boxed)?
            {
                metrics::counter!("sink.message_received").increment(1);

                self.emit
                    .send(
                        Response::builder()
                            .identity(Identity {
                                observed: peer.clone(),
                                assertion: connection_id.clone(),
                            })
                            .body(req)
                            .build(),
                    )
                    .await
                    .map_err(AcceptError::from_err)?;
            }
        }

        Ok(())
    }
}

#[derive(Debug, thiserror::Error)]
enum DriverError {
    #[error("permanent error at {location:?}: {source}")]
    Permanent {
        source: BoxError,
        location: Option<Location>,
    },
    #[error("transient error: {0}")]
    Transient(BoxError),
}

impl From<Elapsed> for DriverError {
    fn from(err: Elapsed) -> Self {
        metrics::counter!("driver.error.connect.timeout").increment(1);

        Self::Transient(Box::new(err) as BoxError)
    }
}

impl From<ConnectError> for DriverError {
    fn from(err: ConnectError) -> Self {
        metrics::counter!("driver.error.connect.connect").increment(1);

        match err {
            ConnectError::Connect { source, .. } => match source {
                // This will happen when reaching out to the discovery service
                // for the endpoint ID and not finding it. It is a transient
                // error and we should just retry to see if the address comes
                // online at some future point.
                ConnectWithOptsError::NoAddress { source, .. } => {
                    Self::Transient(source.into())
                }
                ConnectWithOptsError::InternalConsistencyError {
                    meta, ..
                } => Self::Permanent {
                    source: "RemoteStateActorStoppedError".into(),
                    location: meta.location().cloned(),
                },
                _ => Self::Transient(source.into()),
            },

            _ => Self::Permanent {
                source: err.into(),
                location: None,
            },
        }
    }
}

impl From<ConnectionError> for DriverError {
    fn from(err: ConnectionError) -> Self {
        metrics::counter!("driver.error.stream.open").increment(1);

        Self::Transient(Box::new(err) as BoxError)
    }
}

#[async_trait::async_trait]
pub(crate) trait SinkDriver {
    async fn run<T>(self, rx: broadcast::Receiver<Arc<T>>)
    where
        T: Serialize + Send + Sync + 'static;
}

#[async_trait::async_trait]
impl SinkDriver for Driver {
    async fn run<T>(mut self, mut rx: broadcast::Receiver<Arc<T>>)
    where
        T: Serialize + Send + Sync + 'static,
    {
        let mut retry_connect = tokio::time::interval(
            std::time::Duration::from_millis(Driver::RECONNECT_BACKOFF),
        );
        retry_connect.set_missed_tick_behavior(time::MissedTickBehavior::Skip);

        loop {
            if !self.is_connected() {
                retry_connect.tick().await;

                let (conn, stream) = match self.connect().await {
                    Ok(v) => v,
                    Err(e) => {
                        tracing::warn!(
                            peer = self.addr.id.to_string(), error = ?e,
                            "failed to connect",
                        );

                        match e {
                            DriverError::Permanent { .. } => {
                                tracing::error!(
                                    "unable to connect, stopping driver"
                                );
                                break;
                            }
                            DriverError::Transient(_) => {
                                continue;
                            }
                        }
                    }
                };

                metrics::counter!("driver.connect").increment(1);
                metrics::gauge!("driver.connected").set(1.0);

                self.connection = Some(conn);
                self.stream = Some(stream);

                // Avoid borrowing `self` immutably + mutably in one call.
                let identity = self.identity.clone();
                self.emit_bytes(&identity)
                    .await
                    .inspect_err(|e| {
                        metrics::counter!("driver.error.emit").increment(1);
                        tracing::warn!(err = ?e, "failed to send");
                    })
                    .ok();

                continue;
            }

            tokio::select! {
                _ = self.disconnect() => {
                    metrics::gauge!("driver.connected").set(0.0);
                    metrics::counter!("driver.disconnected").increment(1);
                    tracing::warn!(peer = self.addr.id.to_string(), "disconnected");

                    self.stream = None;
                    self.connection = None;
                }
                r = rx.recv() => {
                    match r {
                        Err(broadcast::error::RecvError::Closed) => return,
                        Err(broadcast::error::RecvError::Lagged(i)) => {
                            metrics::counter!("driver.lagged").increment(i as u64);
                            tracing::warn!(count = i, "skipped");
                        }
                        Ok(data) => {
                            if let Err(e) = self.emit(data).await {
                                metrics::counter!("driver.error.send").increment(1);
                                tracing::error!(err = ?e, "failed to send");
                            }

                            metrics::counter!("driver.sent").increment(1);
                        }
                    }
                }
            }
        }

        self.endpoint.close().await;
    }
}

#[derive(bon::Builder)]
pub(crate) struct Driver {
    endpoint: Endpoint,
    #[builder(into)]
    addr: EndpointAddr,

    // Serialized assertion/identity frame sent on each (re)connect.
    identity: Vec<u8>,

    connect_timeout: Duration,

    connection: Option<Connection>,
    stream: Option<SendStream>,
}

impl Driver {
    const RECONNECT_BACKOFF: u64 = 10000;

    fn is_connected(&self) -> bool {
        self.stream.is_some()
    }

    async fn connect(&self) -> Result<(Connection, SendStream), DriverError> {
        tracing::debug!("trying to connect ....");
        metrics::counter!("driver.reconnect").increment(1);

        let conn = time::timeout(
            self.connect_timeout,
            self.endpoint.connect(self.addr.clone(), ALPN),
        )
        .await??;

        let stream = conn.open_uni().await?;

        Ok((conn, stream))
    }

    async fn disconnect(&self) {
        let Some(stream) = self.stream.as_ref() else {
            return future::pending::<()>().await;
        };

        if let Err(e) = stream.stopped().await {
            tracing::debug!(error = ?e, "stream stopped");
        }
    }

    async fn emit_bytes(&mut self, bytes: &[u8]) -> Result<(), BoxError> {
        let Some(stream) = self.stream.as_mut() else {
            return Err("failed to get stream, disconnected?".into());
        };

        stream.write_u16(bytes.len() as u16).await?;
        stream.write_all(bytes).await?;

        metrics::counter!("driver.emit").increment(1);
        Ok(())
    }

    async fn emit<T>(&mut self, data: T) -> Result<(), BoxError>
    where
        T: Serialize,
    {
        let bytes = postcard::to_allocvec(&data)?;
        self.emit_bytes(&bytes).await
    }
}

pub struct EmitterSender<T>(broadcast::Sender<Arc<T>>);

impl<T> EmitterSender<T> {
    pub fn len(&self) -> usize {
        self.0.len()
    }

    pub fn send(
        &self,
        message: T,
    ) -> Result<usize, broadcast::error::SendError<Arc<T>>> {
        self.0.send(Arc::new(message))
    }
}

#[derive(Clone, bon::Builder)]
pub struct EmitterOpts {
    #[builder(default = 100)]
    pub buffer_size: usize,
    #[builder(default = Duration::from_secs(5))]
    pub connect_timeout: Duration,
}

impl Default for EmitterOpts {
    fn default() -> Self {
        Self::builder().build()
    }
}

pub(crate) async fn spawn_driver<T>(
    buffer_size: usize,
    driver: impl SinkDriver + Send + Sync + 'static,
) -> Result<EmitterSender<T>>
where
    T: Serialize + Send + Sync + 'static,
{
    let (tx, rx) = broadcast::channel(buffer_size);

    tokio::spawn(driver.run(rx).in_current_span());

    Ok(EmitterSender(tx))
}

#[derive(bon::Builder)]
pub struct Client<Assertion>
where
    Assertion: Serialize,
{
    #[builder(into)]
    address: EndpointAddr,
    endpoint: Endpoint,
    identity: Assertion,
    #[builder(default)]
    opts: EmitterOpts,
}

impl<Assertion> Client<Assertion>
where
    Assertion: Serialize,
{
    pub(crate) fn into_driver(self) -> Driver {
        Driver::builder()
            .endpoint(self.endpoint)
            .addr(self.address)
            .identity(postcard::to_allocvec(&self.identity).unwrap())
            .connect_timeout(self.opts.connect_timeout.clone())
            .build()
    }
}

#[cfg(test)]
mod tests {
    use iroh::{
        SecretKey, address_lookup::MdnsAddressLookup, protocol::Router,
    };
    use metrics::Key;
    use rand::rng;
    use test_util::Telemetry;
    use tokio::time;

    use super::*;
    use crate::{Process, now};

    async fn server(
        key: SecretKey,
    ) -> Result<(mpsc::Receiver<Response<Process, u16>>, Router)> {
        // Move this into the server constructor.
        // let (tx, rx) = mpsc::channel(10);
        let sink = Sink::<Process, u16>::build();
        let endpoint = Endpoint::builder()
            .secret_key(key)
            .address_lookup(MdnsAddressLookup::builder())
            .bind()
            .await?;

        endpoint.online().await;

        let (handler, rx) = sink.split();
        let router = Router::builder(endpoint).accept(ALPN, handler).spawn();

        Ok((rx, router))
    }

    #[tokio::test]
    async fn test_client() -> Result<()> {
        const RECEIVE_TIMEOUT: Duration = Duration::from_millis(5000);

        let ctx = Telemetry::new();

        let server_key = SecretKey::generate(&mut rng());
        let client_key = SecretKey::generate(&mut rng());

        let endpoint = Endpoint::builder()
            .secret_key(client_key.clone())
            .address_lookup(MdnsAddressLookup::builder())
            .bind()
            .await?;
        endpoint.online().await;

        let opts = EmitterOpts::builder()
            .buffer_size(1)
            .connect_timeout(Duration::from_millis(100))
            .build();
        let driver = Client::builder()
            .endpoint(endpoint)
            .address(server_key.public())
            .identity(Process::default())
            .opts(opts.clone())
            .build()
            .into_driver();

        let emitter: EmitterSender<u16> =
            spawn_driver::<u16>(opts.buffer_size, driver).await?;

        // Initial connection, this technically tests reconnect as the router
        // isn't running when the emitter starts up.
        {
            let (mut rx, _router) = server(server_key.clone()).await?;
            emitter.send(0)?;

            time::timeout(RECEIVE_TIMEOUT, async {
                let resp = rx.recv().await.expect("to be open");
                assert!(resp.body == 0);
                assert!(resp.identity.observed == client_key.public());
                assert!(
                    resp.received_at <= now(),
                    "{} <= {}",
                    resp.received_at,
                    now()
                );
            })
            .await?;

            assert_eq!(ctx.gauge("driver.connected")?, 1.0);
        }

        tokio::task::yield_now().await;

        ctx.metrics()
            .assert_gauge(&Key::from_static_name("driver.connected"), 0.0)
            .await?;

        for i in 0..2 {
            emitter.send(i)?;
        }
        assert!(emitter.len() == 1);

        {
            let (mut rx, _router) = server(server_key.clone()).await?;

            time::timeout(RECEIVE_TIMEOUT, async {
                let resp = rx.recv().await.expect("to be open");

                // Expects buffer size to be 1.
                assert!(resp.body == 1);
                assert!(resp.identity.observed == client_key.public());
                assert!(
                    resp.received_at <= now(),
                    "{} <= {}",
                    resp.received_at,
                    now()
                );
            })
            .await?;

            assert_eq!(ctx.gauge("driver.connected")?, 1.0);
            assert_eq!(ctx.counter("driver.lagged")?, 1);
        }

        Ok(())
    }
}
