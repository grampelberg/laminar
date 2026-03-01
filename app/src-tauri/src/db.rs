use std::{future::Future, path::PathBuf};

use eyre::Result;
use sqlx::{Pool, Sqlite, sqlite::SqliteConnectOptions};

async fn connect(db_path: &PathBuf) -> Result<Pool<Sqlite>> {
    let options = SqliteConnectOptions::new()
        .filename(db_path)
        .create_if_missing(true);
    let pool = Pool::connect_with(options).await?;
    Ok(pool)
}

pub fn spawn<F, Fut>(path: PathBuf, handler: F)
where
    F: FnOnce(Pool<Sqlite>) -> Fut + Send + 'static,
    Fut: Future<Output = Result<()>> + Send,
{
    tauri::async_runtime::spawn(async move {
        let result: eyre::Result<()> = async {
            handler(connect(&path).await?).await?;
            Ok(())
        }
        .await;

        match result {
            Ok(_) => {
                tracing::error!("db task ended unexpectedly")
            }
            Err(error) => {
                tracing::error!("db task failed: {error:?}")
            }
        }
    });
}
