mod driver;

use std::{sync::Arc, time::Duration};

use eyre::Result;
use iroh::{
    Endpoint, EndpointAddr, EndpointId,
    endpoint::{Connection, RecvStream},
    protocol::{AcceptError, ProtocolHandler},
};
use serde::Serialize;
use strum::EnumDiscriminants;
use tokio::{
    io::AsyncReadExt,
    sync::{broadcast, mpsc},
};
use tracing::Instrument;

use crate::api;

const MAX_RECORD_BYTES: usize = 1024 * 1024;

pub const ALPN: &[u8] = b"inspector/sink/0";

type BoxError = Box<dyn std::error::Error + Send + Sync>;
pub(crate) use driver::Driver;

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
#[derive(Clone, Debug, bon::Builder, serde::Serialize)]
pub struct Response<Assertion, Body> {
    pub identity: Identity<Assertion>,

    #[builder(default = api::now())]
    pub received_at: i64,
    pub event: ResponseEvent<Body>,
}

#[derive(Clone, Debug, serde::Serialize)]
pub struct Identity<T> {
    #[serde(serialize_with = "to_string")]
    pub observed: EndpointId,
    pub assertion: T,
}

fn to_string<S>(
    value: impl std::fmt::Display,
    serializer: S,
) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    serializer.serialize_str(&value.to_string())
}

#[derive(Clone, Debug, PartialEq, Eq, EnumDiscriminants, serde::Serialize)]
#[strum_discriminants(name(ResponseEventKind))]
#[strum_discriminants(derive(serde::Serialize, serde::Deserialize))]
#[strum_discriminants(repr(i64))]
pub enum ResponseEvent<T> {
    Connect,
    Disconnect,
    Data(T),
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
        // 2. First frame is assertion/identity.
        // 3. Emit connect event.
        // 4. Subsequent frames are data messages.
        // 5. Emit disconnect event when the stream closes.
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

            let identity = Identity {
                observed: peer.clone(),
                assertion: connection_id.clone(),
            };

            self.emit
                .send(
                    Response::builder()
                        .identity(identity.clone())
                        .event(ResponseEvent::Connect)
                        .build(),
                )
                .await
                .map_err(AcceptError::from_err)?;

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
                            .identity(identity.clone())
                            .event(ResponseEvent::Data(req))
                            .build(),
                    )
                    .await
                    .map_err(AcceptError::from_err)?;
            }

            self.emit
                .send(
                    Response::builder()
                        .identity(identity)
                        .event(ResponseEvent::Disconnect)
                        .build(),
                )
                .await
                .map_err(AcceptError::from_err)?;
        }

        Ok(())
    }
}

#[async_trait::async_trait]
pub(crate) trait SinkDriver {
    async fn run<T>(self, rx: broadcast::Receiver<Arc<T>>)
    where
        T: Serialize + Send + Sync + 'static;
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
    #[builder(default = Duration::from_secs(10))]
    pub retry_interval: Duration,
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
            .opts(self.opts)
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
    use crate::now;

    async fn server(
        key: SecretKey,
    ) -> Result<(mpsc::Receiver<Response<(), u16>>, Router)> {
        // Move this into the server constructor.
        // let (tx, rx) = mpsc::channel(10);
        let sink = Sink::<(), u16>::build();
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
        const RECEIVE_TIMEOUT: Duration = Duration::from_millis(1000);

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
            .retry_interval(Duration::from_millis(100))
            .build();
        let driver = Client::builder()
            .endpoint(endpoint)
            .address(server_key.public())
            .identity(())
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
                let connected = rx.recv().await.expect("to be open");
                assert!(matches!(connected.event, ResponseEvent::Connect));

                let resp = rx.recv().await.expect("to be open");
                assert!(matches!(resp.event, ResponseEvent::Data(0)));
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
                let connected = rx.recv().await.expect("to be open");
                assert!(matches!(connected.event, ResponseEvent::Connect));

                let resp = rx.recv().await.expect("to be open");

                // Expects buffer size to be 1.
                assert!(matches!(resp.event, ResponseEvent::Data(1)));
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
