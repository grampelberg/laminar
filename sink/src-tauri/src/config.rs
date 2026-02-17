use std::{
    convert::Infallible,
    path::{Path, PathBuf},
};

use chrono::Duration;
use eyre::Result;
use figment::{
    providers::{Format, Serialized, Toml},
    Figment,
};
use inspector::config::{KeySource, LayerConfig, ReaderConfig};
use serde::{Deserialize, Serialize};
use serde_with::{serde_as, serde_conv};

use crate::{error::Error, AppData};

serde_conv!(
    DurationHours,
    Duration,
    |duration: &Duration| duration.num_hours(),
    |hours: i64| Ok::<Duration, Infallible>(Duration::hours(hours))
);

#[tauri::command]
pub fn get_config(state: tauri::State<'_, AppData>) -> Result<Config, Error> {
    let guard = state.config.read()?;
    Ok(guard.clone())
}

#[tauri::command]
pub fn set_config(
    state: tauri::State<'_, AppData>,
    next: Config,
) -> Result<(), Error> {
    next.save(&state.storage.config)?;

    let mut guard = state.config.write()?;

    *guard = next;

    Ok(())
}

#[serde_as]
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Settings {
    #[serde_as(as = "DurationHours")]
    pub retention: Duration,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            retention: Duration::days(7),
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Config {
    pub layer: LayerConfig,
    pub reader: ReaderConfig,
    pub settings: Settings,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            layer: LayerConfig::default(),
            reader: ReaderConfig::default(),
            settings: Settings::default(),
        }
    }
}

impl Config {
    const FILE_NAME: &'static str = "config.toml";
    const KEY_FILE_NAME: &'static str = "reader.key";

    pub fn in_dir(dir: &Path) -> Self {
        Self {
            layer: LayerConfig::default(),
            reader: ReaderConfig {
                key: KeySource::File {
                    path: Self::default_key_path(dir),
                },
                ..ReaderConfig::default()
            },
            settings: Settings::default(),
        }
    }

    pub fn path(app_config_dir: &Path) -> PathBuf {
        app_config_dir.join(Self::FILE_NAME)
    }

    fn default_key_path(app_config_dir: &Path) -> String {
        app_config_dir
            .join(Self::KEY_FILE_NAME)
            .to_string_lossy()
            .to_string()
    }

    pub fn load(app_config_dir: &Path) -> Result<Self> {
        Ok(
            Figment::from(Serialized::defaults(Self::in_dir(app_config_dir)))
                .merge(Toml::file(&Self::path(app_config_dir)))
                .extract::<Self>()?,
        )
    }

    pub fn save(&self, app_config_dir: &Path) -> Result<(), Error> {
        std::fs::create_dir_all(app_config_dir)?;
        let path = Self::path(app_config_dir);
        let content = toml::to_string_pretty(self)?;
        std::fs::write(path, content)?;
        Ok(())
    }
}
