mod keys;

use eyre::Result;
use figment::{
    Figment, Profile, Provider,
    providers::{self, Format},
    value::Dict,
};
use iroh::PublicKey;
use serde::{Deserialize, Serialize};

pub use crate::config::keys::KeySource;

#[derive(Debug, Deserialize, Serialize, Clone, bon::Builder)]
pub struct LayerConfig {
    // TODO: I think it is possible to have a publickey (from str) that causes
    // an RemoteStateActorStoppedError. There needs to be a better validator
    // here because the error is extremely weird when it gets to the driver.
    pub remote: Option<PublicKey>,
    pub display_name: Option<String>,
}

impl Default for LayerConfig {
    fn default() -> Self {
        Self::builder().build()
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ReaderConfig {
    pub key: KeySource,
}

impl Default for ReaderConfig {
    fn default() -> Self {
        Self {
            key: KeySource::default(),
        }
    }
}

#[derive(Default, Debug, Clone, Deserialize, Serialize)]
pub struct Config {
    layer: LayerConfig,
    reader: ReaderConfig,
}

// TODO:
// - Document how to set the sub-keys, eg FOO={key={path="asdf"}}
impl Config {
    const PATH_ENV: &'static str = "INSPECTOR_CONFIG";
    const PATH: &'static str = "~/.config/inspector/config.toml";
    const ENV_PREFIX: &'static str = "INSPECTOR_";

    fn figment_with_path(path: Option<&str>) -> Figment {
        let path = match path {
            Some(path) => path.to_string(),
            None => std::env::var(Config::PATH_ENV)
                .unwrap_or(Config::PATH.to_string()),
        };

        Figment::from(Config::default())
            .merge(providers::Toml::file(shellexpand::tilde(&path).as_ref()))
            .merge(providers::Env::prefixed(Config::ENV_PREFIX))
    }

    pub fn load() -> Result<Config, figment::Error> {
        Config::figment_with_path(None).extract()
    }

    pub fn load_from_path(
        path: impl AsRef<str>,
    ) -> Result<Config, figment::Error> {
        Config::figment_with_path(Some(path.as_ref())).extract()
    }

    pub fn layer(&self) -> LayerConfig {
        self.layer.clone()
    }

    pub fn reader(&self) -> ReaderConfig {
        self.reader.clone()
    }

    pub fn split(&self) -> (LayerConfig, ReaderConfig) {
        (self.layer.clone(), self.reader.clone())
    }
}

impl Provider for Config {
    fn metadata(&self) -> figment::Metadata {
        figment::Metadata::named("inspector/layer")
    }

    fn data(
        &self,
    ) -> Result<figment::value::Map<Profile, Dict>, figment::Error> {
        figment::providers::Serialized::defaults(Config::default()).data()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config() -> Result<()> {
        // use test_util as _;
        let cfg = Config::load()?;

        tracing::info!("Loaded config: {:?}", cfg);

        Ok(())
    }
}
