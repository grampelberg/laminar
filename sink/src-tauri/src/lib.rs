mod record;
mod stream;
mod throttle;

use std::path::PathBuf;

use eyre::Result;
use inspector::config::{KeySource, LayerConfig, ReaderConfig};
use iroh::EndpointId;
use tauri::{Manager, WebviewWindow, Wry};
use tracing_subscriber::{
    filter::{EnvFilter, LevelFilter},
    prelude::*,
    reload::Layer,
};

use crate::stream::RecordStream;

const DB_NAME: &'static str = "inspector.db";
pub(crate) const REFRESH_EVENT: &str = "got_envelope";

#[tauri::command]
fn get_address(state: tauri::State<'_, AppData>) -> String {
    state.address.to_string()
}

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

fn db_url(data_path: PathBuf) -> Result<PathBuf> {
    std::fs::create_dir_all(&data_path)?;
    Ok(data_path.join(DB_NAME))
}

fn clean_app_data(path: PathBuf) -> Result<()> {
    tracing::error!("cleaning {}", path.to_string_lossy());

    std::fs::remove_dir_all(&path)?;

    Ok(())
}

fn load_config(config_path: PathBuf) -> Result<(LayerConfig, ReaderConfig)> {
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

struct AppData {
    address: EndpointId,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let (layer_config, reader_config) =
                load_config(app.handle().path().app_config_dir()?)?;
            let key = reader_config.key.load()?;
            let enable = layer_config.remote == Some(key.public());

            setup_logging(layer_config, enable);

            app.manage(AppData {
                address: key.public(),
            });

            let data_path = app.handle().path().app_data_dir()?;

            #[cfg(feature = "clean")]
            clean_app_data(data_path)?;

            #[cfg(debug_assertions)]
            enable_devtools(
                app.get_webview_window("main")
                    .expect("there's a main window"),
            );

            let db_path = db_url(data_path)?;

            RecordStream::builder()
                .config(reader_config)
                .db_path(db_path)
                .handle(app.handle().clone())
                .key(key)
                .build()
                .spawn();

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_address])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
