use std::{
    io::ErrorKind,
    path::PathBuf,
    pin::Pin,
    task::{Context, Poll},
};

use eyre::{Result, eyre};
use futures::Stream;
use iroh::{
    Endpoint, PublicKey, SecretKey, address_lookup::MdnsAddressLookup,
    protocol::Router,
};
use rand::rng;
use shellexpand::tilde;
use tokio::sync::mpsc::Receiver;
use tracing::Instrument;

use crate::{
    DROP_TARGET, Record,
    api::Process,
    config::{Config, ReaderConfig},
    sink,
};

#[derive(Default)]
pub struct ReaderBuilder {
    config: Option<ReaderConfig>,
    key: Option<SecretKey>,
}

impl ReaderBuilder {
    pub fn config(mut self, cfg: ReaderConfig) -> Self {
        self.config = Some(cfg);
        self
    }

    pub fn key(mut self, key: SecretKey) -> Self {
        self.key = Some(key);
        self
    }

    async fn get_key(path: &str) -> Result<SecretKey> {
        let key_path = PathBuf::from(tilde(&path).as_ref());

        let secret_key = match tokio::fs::read(&key_path).await {
            Ok(bytes) => {
                SecretKey::try_from(bytes.as_slice()).map_err(|e| {
                    eyre!("invalid secret key in {}: {e}", key_path.display())
                })?
            }
            Err(err) if err.kind() == ErrorKind::NotFound => {
                if let Some(parent) = key_path.parent() {
                    tokio::fs::create_dir_all(parent).await?;
                }

                let secret_key = SecretKey::generate(&mut rng());
                tokio::fs::write(&key_path, secret_key.to_bytes()).await?;
                secret_key
            }
            Err(err) => return Err(err.into()),
        };

        Ok(secret_key)
    }

    #[tracing::instrument(
        name = "ReaderBuilder::build",
        target = DROP_TARGET,
        skip_all
    )]
    pub async fn build(self) -> Result<Reader> {
        assert!(
            !tracing::Span::current().is_none(),
            "must be called within a span *and* with a registered subscriber \
             that can return the current span."
        );

        let config = match self.config {
            Some(config) => config,
            None => Config::load()?.reader(),
        };

        let secret_key = match self.key {
            Some(key) => key,
            None => ReaderBuilder::get_key(&config.key).await?,
        };

        let endpoint = Endpoint::builder()
            .secret_key(secret_key)
            .address_lookup(MdnsAddressLookup::builder())
            .bind()
            .in_current_span()
            .await?;

        endpoint.online().await;
        tracing::info!("endpoint: {}", endpoint.id());

        let server = sink::Sink::build();
        let (handler, rx) = server.split();

        let router = Router::builder(endpoint)
            .accept(sink::ALPN, handler)
            .spawn();

        Ok(Reader { rx, router })
    }
}

// This is being tested ~implicitly via the test_logging test for the layer.
// Most of the functionality here is around config management and basic setup.
// See the sink tests for more in-depth tests for the server side of the sink
// itself.
pub struct Reader {
    rx: Receiver<sink::Response<Process, Record>>,
    router: Router,
}

impl Reader {
    pub fn builder() -> ReaderBuilder {
        ReaderBuilder::default()
    }

    pub fn address(&self) -> PublicKey {
        self.router.endpoint().secret_key().public()
    }

    pub async fn shutdown(&self) -> Result<()> {
        self.router.shutdown().await?;
        Ok(())
    }
}

impl Drop for Reader {
    fn drop(&mut self) {
        let router = self.router.clone();
        if let Ok(handle) = tokio::runtime::Handle::try_current() {
            handle.spawn(async move {
                router
                    .shutdown()
                    .await
                    .inspect_err(|e| {
                        tracing::error!(err = ?e, "failed to shutdown router");
                    })
                    .ok();
            });
        }
    }
}

impl Stream for Reader {
    type Item = sink::Response<Process, Record>;

    fn poll_next(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
    ) -> Poll<Option<Self::Item>> {
        self.rx.poll_recv(cx)
    }
}
