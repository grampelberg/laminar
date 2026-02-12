use std::{future, sync::Arc};

use eyre::Result;
use iroh::{
    Endpoint, EndpointAddr,
    endpoint::{
        ConnectError, ConnectWithOptsError, Connection, ConnectionError,
        SendStream,
    },
};
use n0_error::Location;
use serde::Serialize;
use tokio::{
    io::AsyncWriteExt,
    sync::broadcast,
    time::{self, error::Elapsed},
};

use super::{ALPN, BoxError, EmitterOpts, SinkDriver};

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
                // No address yet is transient; keep retrying.
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

#[derive(bon::Builder)]
pub(crate) struct Driver {
    endpoint: Endpoint,
    #[builder(into)]
    addr: EndpointAddr,

    // Serialized assertion/identity frame sent on each (re)connect.
    identity: Vec<u8>,

    opts: EmitterOpts,

    connection: Option<Connection>,
    stream: Option<SendStream>,
}

impl Driver {
    fn is_connected(&self) -> bool {
        self.stream.is_some()
    }

    async fn connect(&self) -> Result<(Connection, SendStream), DriverError> {
        tracing::debug!("trying to connect ....");
        metrics::counter!("driver.reconnect").increment(1);

        let conn = time::timeout(
            self.opts.connect_timeout,
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

#[async_trait::async_trait]
impl SinkDriver for Driver {
    async fn run<T>(mut self, mut rx: broadcast::Receiver<Arc<T>>)
    where
        T: Serialize + Send + Sync + 'static,
    {
        let mut retry_connect = tokio::time::interval(self.opts.retry_interval);
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
                            DriverError::Transient(_) => continue,
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
