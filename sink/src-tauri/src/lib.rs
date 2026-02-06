mod record;

use std::{cell::Cell, path::PathBuf};

use eyre::Result;
use futures::StreamExt;
use inspector::{Envelope, Reader};
use sqlx::{sqlite::SqliteConnectOptions, Row, SqlitePool};
use tauri::{
    ipc::Channel, AppHandle, Emitter, EventLoopMessage, Manager, WebviewWindow,
    Wry,
};
use tokio::{
    fs::remove_dir,
    sync::watch,
    time::{Duration, Instant},
};
use tracing_subscriber::{filter::EnvFilter, prelude::*};

use crate::record::WithSql;

const DB_NAME: &'static str = "inspector.db";
const REFRESH_EVENT: &str = "got_envelope";

#[derive(bon::Builder)]
struct Throttle {
    #[builder(default = Duration::from_millis(100))]
    max: Duration,
    #[builder(default = Instant::now())]
    last_run: Instant,
}

impl Default for Throttle {
    fn default() -> Self {
        Self::builder().build()
    }
}

impl Throttle {
    fn throttled<F>(&mut self, callback: F) -> tauri::Result<()>
    where
        F: FnOnce() -> tauri::Result<()>,
    {
        let now = Instant::now();
        if now.duration_since(self.last_run) < self.max {
            return Ok(());
        }
        self.last_run = now;

        callback()
    }
}

fn enable_devtools(window: WebviewWindow<Wry>) {
    window.open_devtools();
    window.close_devtools();
}

fn setup_logging() {
    color_eyre::install().expect("can install color-eyre");

    let env_filter = EnvFilter::builder().from_env_lossy();
    let fmt = tracing_subscriber::fmt::layer().pretty();

    tracing_subscriber::registry()
        .with(env_filter)
        .with(fmt)
        .init();
}

fn db_url(handle: &AppHandle) -> Result<PathBuf> {
    let db_dir = handle.path().app_data_dir()?;
    std::fs::create_dir_all(&db_dir)?;
    Ok(db_dir.join(DB_NAME))
}

fn clean_app_data(path: PathBuf) -> Result<()> {
    tracing::error!("cleaning {}", path.to_string_lossy());

    std::fs::remove_dir_all(&path)?;

    Ok(())
}

#[tracing::instrument(skip_all, err)]
async fn start_reader(db_path: PathBuf, handle: AppHandle) -> Result<()> {
    let options = SqliteConnectOptions::new()
        .filename(db_path)
        .create_if_missing(true);
    let pool = SqlitePool::connect_with(options).await?;
    sqlx::migrate!().run(&pool).await?;

    // TODO:
    // - I need to expose some way to get the status of this. In particular
    //   whether:
    //   - It is listening
    //   - Something is connected
    //   - What's actually connected.
    //   - Maybe
    let mut reader = Reader::builder().build().await?;
    let mut throttle = Throttle::default();

    while let Some(msg) = reader.next().await {
        let id: i64 = msg.insert(&pool).await?.get("id");
        throttle.throttled(|| handle.emit(REFRESH_EVENT, ()))?;

        // TODO:
        // - I need better logging here.
        // - Add metrics, make it possible to query metrics from the UI.
        tracing::info!("inserted {id}");
    }

    // TODO:
    // - If it gets to this point, nothing's going to work in the app anymore.
    //   Should it panic/restart?

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    setup_logging();

    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            #[cfg(feature = "clean")]
            clean_app_data(app.handle().path().app_data_dir()?)?;

            // #[cfg(debug_assertions)]
            // enable_devtools(
            //     app.get_webview_window("main")
            //         .expect("there's a main window"),
            // );

            let db_path = db_url(app.handle())?;

            tauri::async_runtime::spawn(start_reader(
                db_path,
                app.handle().clone(),
            ));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_stuff() {
        let env_filter = EnvFilter::builder().from_env_lossy();

        let fmt = tracing_subscriber::fmt::layer().pretty();

        tracing_subscriber::registry()
            .with(env_filter)
            .with(fmt)
            .init();

        eprintln!("{:?}", std::env::var("RUST_LOG"));

        tracing::info!("test");
    }
}
