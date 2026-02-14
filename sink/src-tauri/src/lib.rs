mod record;
mod stream;
mod throttle;

use std::path::{Path, PathBuf};

use eyre::Result;
use inspector::config::{KeySource, LayerConfig, ReaderConfig};
use iroh::{Endpoint, EndpointId};
use tauri::{AppHandle, Manager, WebviewWindow, Wry};
use tracing_subscriber::{
    filter::{EnvFilter, LevelFilter},
    prelude::*,
    reload::Layer,
};

use crate::stream::RecordStream;

const DB_NAME: &'static str = "inspector.db";
pub(crate) const ON_EVENT: &str = "got_event";

#[tauri::command]
fn get_config(state: tauri::State<'_, AppData>) -> Config {
    state.config.clone()
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
    let (layer, writer) = inspector::InspectorLayer::builder()
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

fn load_config(config_path: &PathBuf) -> Result<(LayerConfig, ReaderConfig)> {
    let fpath = config_path.join("config.toml");

    let (layer, mut reader) =
        inspector::Config::load_from_path(fpath.to_string_lossy())?.split();

    if matches!(reader.key, KeySource::None) {
        reader.key = KeySource::File {
            path: config_path.join("reader.key").to_string_lossy().to_string(),
        };
    }

    Ok((layer, reader))
}

fn db_config(storage: &Storage) -> Result<(PathBuf, String)> {
    std::fs::create_dir_all(&storage.data)?;
    let path = storage.data.join(DB_NAME);
    let url =
        format!("sqlite:{}", storage.relative_data(&path)?.to_string_lossy());

    Ok((path, url))
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
            config: handle.path().app_config_dir()?.join("config"),
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

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct Config {
    address: String,
    db_url: String,
}

impl Config {
    fn new(address: EndpointId, db_url: String) -> Self {
        Self {
            address: address.to_string(),
            db_url,
        }
    }
}

struct AppData {
    config: Config,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let storage = Storage::from(app.handle())?;

            let (layer_config, reader_config) = load_config(&storage.config)?;
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

            let (db_path, db_url) = db_config(&storage)?;

            app.manage(AppData {
                config: Config::new(key.public(), db_url),
            });

            tracing::info!(path = ?db_path.to_string_lossy(), "db_path");

            RecordStream::builder()
                .config(reader_config)
                .db_path(db_path)
                .handle(app.handle().clone())
                .key(key)
                .build()
                .spawn();

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_config])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
