mod driver;
mod session;

use std::{sync::Arc, time::Duration};

use eyre::Result;
use futures::{StreamExt, stream};
use iroh::{
    Endpoint, EndpointAddr, EndpointId,
    endpoint::{Accept, Connection, RecvStream},
    protocol::{AcceptError, ProtocolHandler},
};
use serde::Serialize;
use serde_with::serde_as;
use strum::EnumDiscriminants;
use tokio::{
    io::AsyncReadExt,
    sync::{broadcast, mpsc},
};
use tracing::Instrument;
use uuid::Uuid;

use crate::api;

pub const ALPN: &[u8] = b"inspector/sink/0";

pub(crate) type BoxError = Box<dyn std::error::Error + Send + Sync>;
pub(crate) use driver::Driver;
use session::Session;

#[serde_as]
#[derive(Clone, Debug, bon::Builder, serde::Serialize)]
pub struct Response<Assertion, Body> {
    #[serde_as(as = "serde_with::DisplayFromStr")]
    #[builder(default = Uuid::new_v4())]
    pub session_id: Uuid,
    pub identity: Identity<Assertion>,

    #[builder(default = api::now())]
    pub received_at: i64,
    pub event: ResponseEvent<Body>,
}

#[serde_as]
#[derive(Clone, Debug, serde::Serialize)]
pub struct Identity<T> {
    #[serde_as(as = "serde_with::DisplayFromStr")]
    pub observed: EndpointId,
    pub assertion: T,
}

#[derive(
    Clone,
    Debug,
    PartialEq,
    Eq,
    EnumDiscriminants,
    serde::Serialize,
    strum::IntoStaticStr,
)]
#[strum_discriminants(name(ResponseEventKind))]
#[strum_discriminants(derive(serde::Serialize, serde::Deserialize))]
#[strum_discriminants(repr(i64))]
pub enum ResponseEvent<T> {
    Connect,
    Heartbeat,
    Disconnect(DisconnectReason),
    Data(T),
}

impl<T> ResponseEvent<T> {
    pub(crate) fn labels(&self) -> Vec<(&'static str, &'static str)> {
        let mut labels = vec![("event", self.into())];

        if let Self::Disconnect(reason) = *self {
            labels.extend(reason.labels());
        }

        labels
    }
}

#[derive(
    Clone,
    Copy,
    Debug,
    PartialEq,
    Eq,
    serde::Serialize,
    serde::Deserialize,
    strum::IntoStaticStr,
)]
#[strum(serialize_all = "snake_case")]
pub enum DisconnectReason {
    Graceful = 0,
    Timeout = 1,
    ServerShutdown = 2,
    CrashRecovery = 3,
    TransportError = 4,
}

impl DisconnectReason {
    pub(crate) fn labels(&self) -> Vec<(&'static str, &'static str)> {
        vec![("reason", self.into())]
    }
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

async fn get_frame<Body>(
    mut byte_stream: RecvStream,
) -> Result<Option<(Body, RecvStream)>, BoxError>
where
    Body: serde::de::DeserializeOwned,
{
    let Ok(frame) = byte_stream.read_u16().await else {
        return Ok(None);
    };

    let mut buf = vec![0u8; frame as usize];
    byte_stream.read_exact(&mut buf).await?;

    Ok(Some((postcard::from_bytes(&buf)?, byte_stream)))
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
        metrics::gauge!("sink.active_connections").increment(1);
        scopeguard::defer! {
            metrics::gauge!("sink.active_connections").decrement(1);
        }

        let peer = connection.remote_id();

        // 1. Open a single unidirection stream to push everything over
        //    (framed).
        // 2. First frame is assertion/identity.
        // 3. Emit connect event.
        // 4. Subsequent frames are data messages.
        // 5. Emit disconnect event when the stream closes.
        while let Some(byte_stream) = connection
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
            metrics::gauge!("sink.active_streams").increment(1);
            scopeguard::defer! {
                metrics::gauge!("sink.active_streams").decrement(1);

            }

            let Some((assertion, byte_stream)): Option<(
                Assertion,
                RecvStream,
            )> = get_frame(byte_stream)
                .in_current_span()
                .await
                .map_err(AcceptError::from_boxed)?
            else {
                continue;
            };

            let msg_stream = stream::try_unfold(byte_stream, |byte_stream| {
                get_frame(byte_stream).in_current_span()
            })
            .boxed();

            Session::builder()
                .identity(Identity {
                    observed: peer.clone(),
                    assertion,
                })
                .stream(msg_stream)
                .emit(self.emit.clone())
                .build()
                .run()
                .await?;
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
