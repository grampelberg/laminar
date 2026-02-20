//! An inspector for tracing events.
mod api;
pub mod config;
mod reader;
pub mod sink;

use std::{collections::HashMap, fmt, sync::Arc};

use eyre::Result;
use iroh::{Endpoint, EndpointAddr, address_lookup::MdnsAddressLookup};
pub use reader::Reader;
use tokio::{
    sync::{
        broadcast,
        mpsc::{self, Receiver, Sender},
    },
    task::JoinHandle,
};
use tracing::{Instrument, Subscriber, field::Visit};
use tracing_subscriber::{Layer, layer::Context, registry::LookupSpan};

pub use crate::{api::*, config::Config};
use crate::{
    config::LayerConfig,
    sink::{EmitterOpts, EmitterSender, SinkDriver, emitter},
};

const DROP_TARGET: &str = "inspector::drop";

#[derive(bon::Builder)]
pub struct Writer {
    rx: broadcast::Receiver<Arc<Record>>,
    config: LayerConfig,
    source: Option<SourceProcess>,
}

// TODO:
// - Is there some way to defer close until the buffer has been flushed?
// - Maybe this can be a raw function instead of a struct? Definitely not doing
//   much.
impl Writer {
    pub async fn run(self) -> Result<JoinHandle<()>> {
        // The `inspector::drop` target is important. That's used for filtering
        // so that event/span recursion doesn't happen. Anything child
        // that has a parent including that target will end up being
        // dropped by the layer automatically.
        let span = tracing::error_span!(
            target: DROP_TARGET,
            parent: tracing::Span::current(),
            "Writer::run"
        );

        let _drop = span.enter();

        let Some(addr): Option<EndpointAddr> =
            self.config.remote.map(Into::into)
        else {
            tracing::warn!("disabling writer, no address configured");
            return Ok(tokio::spawn(async {}));
        };

        let opts = EmitterOpts::default();
        let endpoint = Endpoint::builder().bind().in_current_span().await?;

        let driver = sink::Client::builder()
            .endpoint(endpoint)
            .opts(opts.clone())
            .address(addr)
            .identity(
                Claims::builder()
                    .maybe_display_name(self.config.display_name)
                    .maybe_source(self.source)
                    .build(),
            )
            .build()
            .into_driver();

        if !tracing::dispatcher::get_default(|d| {
            d.enabled(span.metadata().expect("just constructed"))
        }) {
            panic!(
                "must be run within a span that has the drop target. Is there \
                 a subscriber registered? Does it allow {DROP_TARGET}=error?"
            )
        }

        Ok(tokio::spawn(driver.run(self.rx).in_current_span()))
    }
}

struct DropCallsite;

pub struct InspectorLayerBuilder {
    config: Option<LayerConfig>,
}

impl InspectorLayerBuilder {
    pub fn config(mut self, cfg: LayerConfig) -> Self {
        self.config = Some(cfg);
        self
    }

    pub fn maybe_config(mut self, cfg: Option<LayerConfig>) -> Self {
        self.config = cfg;
        self
    }

    pub fn build(self) -> Result<(InspectorLayer, Writer)> {
        let config = match self.config {
            Some(cfg) => cfg,
            None => Config::load()?.layer(),
        };

        let (tx, rx) = emitter(EmitterOpts::default().buffer_size);

        Ok((
            InspectorLayer {
                tx,
                disabled: config.remote.is_none(),
            },
            Writer::builder()
                .rx(rx)
                .config(config)
                .source(SourceProcess::default())
                .build(),
        ))
    }
}

// Warning: if the writer and reader are in the same process, you must exempt
// the reader by running it in a DROP_TARGET span.
//
// TODO: I want this to work in WASM environments. The network
// stack is going to need to be pluggable and most of tokio won't be usable.
pub struct InspectorLayer {
    disabled: bool,
    tx: EmitterSender<Record>,
}

impl InspectorLayer {
    const BUFFER_CAPACITY: usize = 1000;

    pub fn new() -> Result<(Self, Writer)> {
        Ok(Self::builder().build()?)
    }

    pub fn builder() -> InspectorLayerBuilder {
        InspectorLayerBuilder { config: None }
    }

    fn send(&self, record: Record) {
        if self.disabled() {
            return;
        }

        if let Err(_) = self.tx.send(record) {
            tracing::debug!("unable to send record");
        }
    }

    pub fn disabled(&self) -> bool {
        self.disabled || self.tx.is_closed()
    }
}

// It is important that spans/events generated as part of the inspector layer
// itself are dropped. They multiply exponentially otherwise. To do the
// dropping, we:
//
// - Look for a span that has target `inspector::drop`.
// - Add an extension `DropCallsite` to the span.
// - Look for a parent span that has the `DropCallsite` extension.
//
// In either case, we drop the span. For events, we look for the parent span and
// drop it.
//
// Note that this is not 100% effective.
//
// - Spans do not cross async boundaries by default. The best practice is to use
//   `instrument` or `in_current_span`. Unfortunately, because this is up to the
//   library author, it doesn't always happen.
// - Some library authors explicitly remove the parent span entirely (iroh's
//   `RemoteStateActor`) for example.
// - The tokio runtime starts up outside of the inspector layer itself and is
//   shared.
// - Some events have the span explicitly removed.
impl<S> Layer<S> for InspectorLayer
where
    S: Subscriber + for<'a> LookupSpan<'a>,
{
    fn on_new_span(
        &self,
        attrs: &tracing::span::Attributes<'_>,
        id: &tracing::span::Id,
        ctx: Context<'_, S>,
    ) {
        if self.disabled() {
            return;
        }

        let span = ctx.span(id).expect("span exists");
        let will_drop = span
            .parent()
            .map(|p| p.extensions().get::<DropCallsite>().is_some())
            .unwrap_or(false);

        if attrs.metadata().target() == DROP_TARGET || will_drop {
            span.extensions_mut().insert(DropCallsite);
            metrics::counter!("layer.drop.span").increment(1);

            return;
        }

        // I'm spot checking that the networking spans are *mostly* being
        // dropped in the tests. To keep from having a cardinality explosion, we
        // only do this for running tests.
        #[cfg(test)]
        {
            metrics::counter!("layer.span", "target" => attrs.metadata().target())
                .increment(1);

            let tree = ctx
                .span_scope(id)
                .map(|scope| scope.map(|item| item.name()).collect::<Vec<_>>());

            tracing::debug!(
                tree = ?tree,
                "emitting span"
            );
        }

        metrics::counter!("layer.span").increment(1);

        self.send(Record::from_span(attrs, id));
    }

    fn on_event(&self, event: &tracing::Event<'_>, ctx: Context<'_, S>) {
        if self.disabled() {
            return;
        }

        let will_drop = ctx
            .lookup_current()
            .map(|p| p.extensions().get::<DropCallsite>().is_some())
            .unwrap_or(false);

        if will_drop {
            metrics::counter!("layer.drop.event").increment(1);

            return;
        }

        // I'm spot checking that the networking events are *mostly* being
        // dropped in the tests. To keep from having a cardinality explosion, we
        // only do this for running tests.
        #[cfg(test)]
        {
            metrics::counter!("layer.event", "target" => event.metadata().target())
                .increment(1);

            let tree = ctx
                .event_scope(event)
                .map(|scope| scope.map(|item| item.name()).collect::<Vec<_>>());

            tracing::debug!(
                tree = ?tree,
                "emitting event"
            );
        }

        metrics::counter!("layer.event").increment(1);

        self.send(Record::from_event(event));
    }
}

#[cfg(test)]
mod test {
    use std::{sync::Arc, time::Duration};

    use iroh::SecretKey;
    use metrics::Key;
    use rand::rng;
    use serde::Serialize;
    use test_util::{Telemetry, metrics::MemoryRecorder};
    use tokio::{sync::broadcast, time};
    use tracing_subscriber::{filter::LevelFilter, prelude::*};

    use super::*;
    use crate::sink::SinkDriver;

    // TODO: need a multi-threaded test
    #[tokio::test]
    async fn test_logging() -> Result<()> {
        color_eyre::install().ok();
        let recorder = MemoryRecorder::new();
        let _drop = metrics::set_default_local_recorder(&recorder);

        eprintln!(
            "logging output is disabled by default, if this fails, run with \
             -F test_pretty"
        );

        let keypair = SecretKey::generate(&mut rng());
        tracing::info!("{}", keypair.public());

        let (layer, writer) = InspectorLayer::builder()
            .config(LayerConfig::builder().remote(keypair.public()).build())
            .build()?;

        #[cfg(feature = "test_pretty")]
        let _drop_subscriber = {
            let fmt = tracing_subscriber::fmt::layer().pretty();
            tracing_subscriber::registry()
                .with(fmt)
                .with(LevelFilter::DEBUG)
                .with(layer)
                .set_default()
        };

        #[cfg(not(feature = "test_pretty"))]
        let _drop_subscriber = tracing_subscriber::registry()
            .with(LevelFilter::DEBUG)
            .with(layer)
            .set_default();

        writer.run().await?;

        let drop_span = tracing::error_span!(
            target: DROP_TARGET,
            "inspector::drop"
        );

        // It is important that this happens *after* the subscriber has been
        // registered. Otherwise, there's no "current" span and everything in
        // the router isn't attached correctly (causing spans to go through that
        // should have been dropped).
        let _reader = Reader::builder()
            .key(keypair.clone())
            .build()
            .instrument(drop_span)
            .await?;

        tracing::info!("testing...");

        let dropped_spans =
            recorder.get_counter(&Key::from_static_name("layer.drop.span"))?;
        assert!(dropped_spans > 0, "No spans were dropped");
        let spans =
            recorder.get_counter(&Key::from_static_name("layer.span"))?;
        assert!(spans > 0, "No spans were recorded");

        let dropped_events =
            recorder.get_counter(&Key::from_static_name("layer.drop.event"))?;
        assert!(dropped_events > 0, "No events were dropped");
        let events =
            recorder.get_counter(&Key::from_static_name("layer.event"))?;
        assert!(events > 0, "No events were recorded");

        let counters = recorder.all_counters();
        let targets = counters
            .keys()
            .filter(|k| k.name() == "layer.span")
            .map(|k| {
                k.labels()
                    .filter(|l| l.key() == "target")
                    .map(|l| l.value())
            })
            .flatten()
            .collect::<Vec<_>>();

        assert!(
            targets
                .iter()
                .filter(|t| t.contains("iroh::socket")
                    && !t.contains("remote_state"))
                .count()
                == 0,
            "found iroh::socket, should be dropping more targets: {targets:?}"
        );

        Ok(())
    }

    // Verify that everything is disabled when a remote is not configured.
    #[tokio::test]
    async fn test_disabled() -> Result<()> {
        let (layer, writer) = InspectorLayer::builder()
            .config(LayerConfig::builder().build())
            .build()?;

        time::timeout(Duration::from_millis(10), writer.run()).await??;

        assert!(layer.disabled());

        Ok(())
    }

    // Check to make sure the writer continues to run, even when the driver is
    // unable to connect. Events should continue to be sent.
    #[tokio::test]
    async fn test_reconnect() -> Result<()> {
        let _tel = Telemetry::new();

        let keypair = SecretKey::generate(&mut rng());
        tracing::info!("{}", keypair.public());

        let (layer, writer) = InspectorLayer::builder()
            .config(LayerConfig::builder().remote(keypair.public()).build())
            .build()?;

        let handle = writer.run().await?;
        time::sleep(Duration::from_millis(100)).await;

        assert!(!handle.is_finished());
        assert!(!layer.disabled());

        Ok(())
    }

    struct MockDriver;

    #[async_trait::async_trait]
    impl SinkDriver for MockDriver {
        async fn run<T>(self, _: broadcast::Receiver<Arc<T>>)
        where
            T: Serialize + Send + Sync + 'static,
        {
        }
    }

    #[tokio::test]
    async fn test_garbage_collection() -> Result<()> {
        let _tel = Telemetry::new();

        let (layer, writer) = InspectorLayer::builder()
            .config(LayerConfig::builder().build())
            .build()?;

        time::timeout(
            Duration::from_millis(10),
            tokio::spawn(MockDriver {}.run(writer.rx)),
        )
        .await??;

        assert!(layer.disabled());

        Ok(())
    }
}
