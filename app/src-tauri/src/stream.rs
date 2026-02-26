use std::path::PathBuf;

use eyre::Result;
use futures::StreamExt;
use iroh::SecretKey;
use laminar_stream::{Reader, config::ReaderConfig};
use sqlx::{Pool, Sqlite, sqlite::SqliteConnectOptions};
use tauri::{AppHandle, Emitter};
use tracing::Instrument;

use crate::{
    ON_EVENT,
    debounce::Debounce,
    record::{WithSql, close_open_sessions},
};

pub const MESSAGE_RECEIVED: &str = "message.received";

#[derive(bon::Builder)]
pub struct RecordStream {
    handle: AppHandle,
    db_path: PathBuf,
    config: ReaderConfig,
    key: SecretKey,
}

impl RecordStream {
    pub fn spawn(self) {
        tauri::async_runtime::spawn(
            async move {
                match self.run().await {
                    Ok(_) => {
                        tracing::error!("record stream ended unexpectedly")
                    }
                    Err(e) => tracing::error!("record stream failed: {e:?}"),
                }
            }
            .in_current_span(),
        );
    }

    #[tracing::instrument(skip_all, err)]
    async fn run(self) -> Result<()> {
        let pool = connect(self.db_path).await?;
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

async fn connect(db_path: PathBuf) -> Result<Pool<Sqlite>> {
    let options = SqliteConnectOptions::new()
        .filename(db_path)
        .create_if_missing(true);
    let pool = Pool::connect_with(options).await?;
    sqlx::migrate!().run(&pool).await?;
    Ok(pool)
}
