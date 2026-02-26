mod config;
mod debounce;
mod error;
mod record;
mod series;
mod stream;

use std::{convert::Infallible, path::PathBuf, sync::RwLock};

use blackbox_metrics::{
    BlackboxRecorder, CounterKey, CounterValue, KeyExt,
    sampler::{Sampler, SamplerHandle, SamplerOptions},
};
use eyre::Result;
use iroh::EndpointId;
use laminar_stream::config::LayerConfig;
use serde_with::serde_as;
use tauri::{AppHandle, Manager, WebviewWindow, Wry};
use tracing_subscriber::{filter::EnvFilter, prelude::*};

use crate::{
    config::{get_config, set_config},
    series::{MESSAGE_SERIES_CAPACITY, MESSAGE_SERIES_INTERVAL, get_series},
    stream::{MESSAGE_RECEIVED, RecordStream},
};

const DB_NAME: &'static str = "laminar.db";
pub(crate) const ON_EVENT: &str = "got_event";

serde_with::serde_conv!(
    PathBufAsString,
    PathBuf,
    |path: &PathBuf| path.to_string_lossy().to_string(),
    |value: String| Ok::<PathBuf, Infallible>(PathBuf::from(value))
);

#[tauri::command]
fn get_state(state: tauri::State<'_, AppData>) -> State {
    state.state.clone()
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct Status {
    db_size: u64,
}

#[tauri::command]
fn get_status(state: tauri::State<'_, AppData>) -> tauri::Result<Status> {
    let meta = std::fs::metadata(&state.state.db.path)?;

    Ok(Status {
        db_size: meta.len(),
    })
}

#[cfg(debug_assertions)]
fn enable_devtools(window: WebviewWindow<Wry>) {
    window.open_devtools();
    window.close_devtools();
}

fn setup_logging(config: LayerConfig, enable: bool) -> Result<()> {
    color_eyre::install().expect("can install color-eyre");

    let env_filter = EnvFilter::builder().from_env_lossy();
    let fmt = tracing_subscriber::fmt::layer().pretty();
    let (layer, writer) = laminar_stream::InspectorLayer::builder()
        .config(config)
        .build()?;

    tracing_subscriber::registry()
        .with(env_filter)
        .with(fmt)
        .with(enable.then(|| layer))
        .init();

    if enable {
        tauri::async_runtime::spawn(writer.run());
    } else {
        tracing::warn!(
            "inspector layer disabled, source and destination addresses \
             cannot be the same process."
        )
    }

    Ok(())
}

fn clean_app_data(path: &PathBuf) -> Result<()> {
    tracing::error!("cleaning {}", path.to_string_lossy());

    std::fs::remove_dir_all(&path).ok();

    Ok(())
}

fn db_config(storage: &Storage) -> Result<DbConfig> {
    std::fs::create_dir_all(&storage.data)?;
    let path = storage.data.join(DB_NAME);
    let url =
        format!("sqlite:{}", storage.relative_data(&path)?.to_string_lossy());

    Ok(DbConfig { path, url })
}

struct Storage {
    root: PathBuf,
    config: PathBuf,
    data: PathBuf,
}

impl Storage {
    fn from(handle: &AppHandle<Wry>) -> Result<Self> {
        let root = handle.path().app_data_dir()?;

        Ok(Self {
            root: root.clone(),
            config: handle.path().app_config_dir()?,
            data: root.join("data"),
        })
    }

    fn relative_data(&self, path: &PathBuf) -> Result<PathBuf> {
        Ok(path.strip_prefix(&self.root)?.to_path_buf())
    }
}

impl std::fmt::Debug for Storage {
    fn fmt(
        &self,
        f: &mut std::fmt::Formatter<'_>,
    ) -> Result<(), std::fmt::Error> {
        write!(
            f,
            "Storage {{ config: {:?}, data: {:?} }}",
            self.config, self.data
        )
    }
}

#[serde_as]
#[derive(Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct DbConfig {
    #[serde_as(as = "PathBufAsString")]
    path: PathBuf,
    url: String,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct State {
    address: String,
    db: DbConfig,
}

impl State {
    fn new(address: EndpointId, db: DbConfig) -> Self {
        Self {
            address: address.to_string(),
            db,
        }
    }
}

struct AppData {
    storage: Storage,
    config: RwLock<config::Config>,
    metrics: SamplerHandle<CounterKey, CounterValue>,
    state: State,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let recorder = BlackboxRecorder::default();
    metrics::set_global_recorder(recorder.clone()).expect("no other recorder");

    let options = SamplerOptions::builder()
        .capacity(MESSAGE_SERIES_CAPACITY)
        .interval(MESSAGE_SERIES_INTERVAL)
        .build();
    let (sampler, runner) = Sampler::new_with_opts(
        recorder.clone(),
        vec![MESSAGE_RECEIVED.into_counter()],
        options,
    )
    .into_runner();

    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .setup(move |app| {
            let shutdown_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let _ = tokio::signal::ctrl_c().await;
                shutdown_handle.exit(0);
            });

            let storage = Storage::from(app.handle())?;

            let config = config::Config::load(&storage.config)?;

            let layer_config = config.layer.clone();
            let reader_config = config.reader.clone();
            let key = reader_config.key.load()?;

            let enable = layer_config.remote != Some(key.public());
            setup_logging(layer_config.clone(), enable)?;

            tracing::info!(
                key = ?key.public(),
                remote = ?layer_config.remote,
                storage = ?storage,
                "config"
            );

            #[cfg(feature = "clean")]
            clean_app_data(&storage.data)?;

            #[cfg(debug_assertions)]
            enable_devtools(
                app.get_webview_window("main")
                    .expect("there's a main window"),
            );

            let db = db_config(&storage)?;

            tauri::async_runtime::spawn(runner);

            app.manage(AppData {
                storage,
                config: RwLock::new(config),
                metrics: sampler,
                state: State::new(key.public(), db.clone()),
            });

            tracing::info!(path = ?db.path.to_string_lossy(), "db_path");

            RecordStream::builder()
                .config(reader_config)
                .db_path(db.path)
                .handle(app.handle().clone())
                .key(key)
                .build()
                .spawn();

            Ok(())
        })
        // When adding commands, make sure to also add the stubs to
        // dispatchInvoke. Otherwise, the design playground can fail.
        .invoke_handler(tauri::generate_handler![
            get_state, get_status, get_config, set_config, get_series
        ])
        .build(tauri::generate_context!())
        .expect("failed to build the app")
        .run(move |handle, ev| {
            #[cfg(debug_assertions)]
            if let tauri::RunEvent::ExitRequested { .. } = ev {
                eprintln!("\n====metrics=====\n{}", recorder.snapshot());
            }
        })
}
