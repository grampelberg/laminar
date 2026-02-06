use std::path::PathBuf;

use eyre::Result;
use futures::StreamExt;
use inspector::{Reader, config::ReaderConfig};
use iroh::SecretKey;
use sqlx::{Pool, Row, Sqlite, sqlite::SqliteConnectOptions};
use tauri::{AppHandle, Emitter};
use tracing::Instrument;

use crate::{REFRESH_EVENT, record::WithSql, throttle::Throttle};

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

        let mut reader = Reader::builder()
            .config(self.config)
            .key(self.key)
            .build()
            .await?;
        let mut throttle = Throttle::default();

        while let Some(msg) = reader.next().await {
            let id: i64 = msg.insert(&pool).await?.get("id");
            throttle.throttled(|| self.handle.emit(REFRESH_EVENT, ()))?;
            tracing::info!("inserted {id}");
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
