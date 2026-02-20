use std::time::Duration;

use futures::{StreamExt, stream, stream::BoxStream};
use iroh::protocol::AcceptError;
use tokio::{
    sync::mpsc,
    time::{self, MissedTickBehavior},
};
use uuid::Uuid;

use super::{DisconnectReason, Identity, Response, ResponseEvent};
use crate::sink::BoxError;

const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(30);

async fn emit_response<Assertion, Body>(
    emit: &mpsc::Sender<Response<Assertion, Body>>,
    response: Response<Assertion, Body>,
) -> Result<(), AcceptError>
where
    Assertion: Send + Sync + 'static,
    Body: Send + Sync + 'static,
{
    metrics::counter!("sink.response", &response.event.labels()).increment(1);

    emit.send(response).await.map_err(AcceptError::from_err)?;

    Ok(())
}

#[derive(bon::Builder)]
pub(crate) struct Session<'a, Assertion, Body> {
    #[builder(default = Uuid::new_v4())]
    id: Uuid,
    #[builder(default = HEARTBEAT_INTERVAL)]
    heartbeat_interval: Duration,
    identity: Identity<Assertion>,
    stream: BoxStream<'a, Result<Body, BoxError>>,
    emit: mpsc::Sender<Response<Assertion, Body>>,
}

impl<'a, Assertion, Body> Session<'a, Assertion, Body>
where
    Assertion: Clone + Send + Sync + 'static,
    Body: Send + Sync + 'static,
{
    fn response(
        &self,
        event: ResponseEvent<Body>,
    ) -> Response<Assertion, Body> {
        Response::builder()
            .session_id(self.id)
            .identity(self.identity.clone())
            .event(event)
            .build()
    }

    pub(crate) async fn run(mut self) -> Result<(), AcceptError>
    where
        Body: serde::de::DeserializeOwned + std::fmt::Debug,
    {
        tracing::info!(
            peer = self.identity.observed.to_string(),
            "session established"
        );
        emit_response(&self.emit, self.response(ResponseEvent::Connect))
            .await?;

        let mut heartbeat = time::interval(self.heartbeat_interval);
        heartbeat.set_missed_tick_behavior(MissedTickBehavior::Skip);

        let disconnect_reason = loop {
            tokio::select! {
                _ = heartbeat.tick() => {
                    tracing::debug!("sending heartbeat");
                    emit_response(&self.emit, self.response(ResponseEvent::Heartbeat))
                        .await?;
                }
                maybe_req = self.stream.next() => {
                    let req = match maybe_req {
                        Some(Ok(req)) => req,
                        None => break DisconnectReason::Graceful,
                        Some(Err(err)) => {
                            tracing::debug!(err = ?err, "stream error");

                            emit_response(&self.emit, self.response(ResponseEvent::Error(err.to_string())))
                                .await?;

                            break DisconnectReason::TransportError;
                        }
                    };

                    metrics::counter!("sink.message_received").increment(1);
                    emit_response(&self.emit, self.response(ResponseEvent::Data(req)))
                        .await?;
                }

            }
        };

        emit_response(
            &self.emit,
            self.response(ResponseEvent::Disconnect(disconnect_reason)),
        )
        .await?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use futures::stream::BoxStream;
    use iroh::{EndpointId, SecretKey};
    use rand::rng;
    use test_util::Telemetry;

    use super::*;

    #[tokio::test]
    async fn test_heartbeat_does_not_cancel_stream_progress() {
        let _tel = Telemetry::new();

        let (tx, mut rx) = mpsc::channel::<Response<(), u16>>(32);
        let heartbeat_interval = Duration::from_millis(10);
        let msg_stream: BoxStream<'static, Result<u16, BoxError>> =
            stream::once(async move {
                time::sleep(Duration::from_millis(60)).await;
                Ok::<u16, BoxError>(7)
            })
            .boxed();

        let session = Session::builder()
            .heartbeat_interval(heartbeat_interval)
            .identity(Identity {
                observed: EndpointId::from(
                    SecretKey::generate(&mut rng()).public(),
                ),
                assertion: (),
            })
            .stream(msg_stream)
            .emit(tx)
            .build();

        let handle = tokio::spawn(async move { session.run().await });

        let connect = rx.recv().await.expect("connect event");
        assert!(matches!(connect.event, ResponseEvent::Connect));

        let mut saw_heartbeat = false;
        let mut saw_data = false;
        let mut saw_disconnect = false;

        tokio::time::timeout(Duration::from_secs(1), async {
            while let Some(response) = rx.recv().await {
                match response.event {
                    ResponseEvent::Heartbeat => saw_heartbeat = true,
                    ResponseEvent::Data(7) => saw_data = true,
                    ResponseEvent::Disconnect(DisconnectReason::Graceful) => {
                        saw_disconnect = true;
                        break;
                    }
                    _ => {}
                }
            }
        })
        .await
        .expect("timed out waiting for data/disconnect");

        let result = handle.await.expect("task join");
        assert!(result.is_ok());
        assert!(saw_heartbeat, "expected at least one heartbeat");
        assert!(saw_data, "expected data event");
        assert!(saw_disconnect, "expected graceful disconnect");
    }
}
