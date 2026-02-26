use std::{io::ErrorKind, path::PathBuf, str::FromStr};

use data_encoding::BASE32_NOPAD;
use eyre::{Result, WrapErr, eyre};
use iroh::SecretKey;
use rand::rng;
use serde::{Deserialize, Serialize};
use shellexpand::tilde;

const DEFAULT_KEY_PATH: &str = "~/.config/inspector/reader.key";

#[derive(Debug, Default, Clone, Deserialize, Serialize)]
#[serde(untagged)]
pub enum KeySource {
    #[default]
    None,
    File { path: String },
    Env { var: String },
}

impl KeySource {
    fn path(&self) -> Option<&str> {
        match self {
            Self::None => Some(DEFAULT_KEY_PATH),
            Self::File { path } => Some(path),
            Self::Env { .. } => None,
        }
    }

    fn key_path(&self) -> Option<PathBuf> {
        self.path().map(|path| PathBuf::from(tilde(path).as_ref()))
    }

    fn parse_secret_key(value: &str, source: &str) -> Result<SecretKey> {
        SecretKey::from_str(value.trim())
            .map_err(|e| eyre!("invalid secret key in {source}: {e}"))
    }

    fn encode_secret_key(secret_key: &SecretKey) -> String {
        BASE32_NOPAD.encode(&secret_key.to_bytes())
    }

    pub fn load(&self) -> Result<SecretKey> {
        if let Self::Env { var } = self {
            let value = std::env::var(var)
                .map_err(|_| eyre!("missing env var for reader key: {var}"))?;
            return Self::parse_secret_key(&value, &format!("env var {var}"));
        }

        let key_path = self
            .key_path()
            .ok_or_else(|| eyre!("missing path for file key source"))?;

        let secret_key = match std::fs::read_to_string(&key_path) {
            Ok(content) => {
                Self::parse_secret_key(&content, &key_path.to_string_lossy())?
            }
            Err(err) if err.kind() == ErrorKind::NotFound => {
                if let Some(parent) = key_path.parent() {
                    std::fs::create_dir_all(parent)?;
                }

                let secret_key = SecretKey::generate(&mut rng());
                std::fs::write(
                    &key_path,
                    Self::encode_secret_key(&secret_key),
                )?;
                secret_key
            }
            Err(err) => {
                return Err(eyre!(
                    "problem encountered loading key file {}:\n{err}",
                    key_path.display()
                ));
            }
        };

        Ok(secret_key)
    }

    pub async fn load_async(&self) -> Result<SecretKey> {
        if let Self::Env { var } = self {
            let value = std::env::var(var)
                .map_err(|_| eyre!("missing env var for reader key: {var}"))?;
            return Self::parse_secret_key(&value, &format!("env var {var}"));
        }

        let key_path = self
            .key_path()
            .ok_or_else(|| eyre!("missing path for file key source"))?;

        let secret_key = match tokio::fs::read_to_string(&key_path).await {
            Ok(content) => {
                Self::parse_secret_key(&content, &key_path.to_string_lossy())?
            }
            Err(err) if err.kind() == ErrorKind::NotFound => {
                if let Some(parent) = key_path.parent() {
                    tokio::fs::create_dir_all(parent).await?;
                }

                let secret_key = SecretKey::generate(&mut rng());
                tokio::fs::write(
                    &key_path,
                    Self::encode_secret_key(&secret_key),
                )
                .await?;
                secret_key
            }
            Err(err) => {
                return Err(err).wrap_err_with(|| {
                    format!(
                        "problem encountered loading key file {}",
                        key_path.display()
                    )
                });
            }
        };

        Ok(secret_key)
    }
}
