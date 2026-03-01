use eyre::Result;
use futures::StreamExt;
use iroh::SecretKey;
use laminar_stream::{Reader, config::ReaderConfig};
use sqlx::{Pool, Sqlite};
use tauri::{AppHandle, Emitter};

use crate::{
    ON_EVENT,
    debounce::Debounce,
    record::{WithSql, close_open_sessions},
};

pub const MESSAGE_RECEIVED: &str = "message.received";

#[derive(bon::Builder)]
pub struct RecordStream {
    handle: AppHandle,

    config: ReaderConfig,
    key: SecretKey,
}

impl RecordStream {
    #[tracing::instrument(skip_all, err)]
    pub async fn run(self, pool: Pool<Sqlite>) -> Result<()> {
        let closed = close_open_sessions(&pool).await?;
        if closed > 0 {
            tracing::info!(closed, "closed stale sessions on startup");
        }

        let mut reader = Reader::builder()
            .config(self.config)
            .key(self.key)
            .build()
            .await?;
        let mut debounce = Debounce::default();

        loop {
            tokio::select! {
                Some(msg) = reader.next() => {
                    msg.insert(&pool).await?;
                    debounce.trigger();

                    metrics::counter!(MESSAGE_RECEIVED).increment(1);
                    tracing::debug!("received message");
                }
                _ = debounce.ready() => {
                    self.handle.emit(ON_EVENT, ())?;
                }
            }
        }
    }
}
