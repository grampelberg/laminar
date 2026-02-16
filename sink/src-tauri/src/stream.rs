use std::path::PathBuf;

use eyre::Result;
use futures::StreamExt;
use inspector::{config::ReaderConfig, Reader};
use iroh::SecretKey;
use sqlx::{sqlite::SqliteConnectOptions, Pool, Sqlite};
use tauri::{AppHandle, Emitter};
use tracing::Instrument;

use crate::{
    debounce::Debounce,
    record::{close_open_sessions, WithSql},
    ON_EVENT,
};

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

                    tracing::debug!("received message");
                }
                _ = debounce.ready() => {
                    self.handle.emit(ON_EVENT, ())?;
                }
            }
        }

        Ok(())
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
