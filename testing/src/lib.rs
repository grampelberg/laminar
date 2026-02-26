use ::metrics::{self as metrics_rs, Key};
use blackbox_metrics::{BlackboxRecorder, KeyExt, MetricsRead};
use eyre::Result;
use self_cell::self_cell;
use tokio::runtime::{Handle, RuntimeFlavor};
use tracing::subscriber::DefaultGuard;
use tracing_subscriber::{EnvFilter, prelude::*};

type MetricsGuard<'a> = metrics_rs::LocalRecorderGuard<'a>;

self_cell! {
    struct MetricsCell {
        owner: BlackboxRecorder,
        #[covariant]
        dependent: MetricsGuard,
    }
}

pub struct Telemetry {
    metrics: MetricsCell,
    _tracing_guard: DefaultGuard,
}

impl Telemetry {
    pub fn new() -> Self {
        color_eyre::install().ok();

        if let Some(handle) = Handle::try_current().ok() {
            if handle.runtime_flavor() != RuntimeFlavor::CurrentThread {
                panic!(
                    "Telemetry can only be used with a current-thread runtime"
                )
            }
        }

        let metrics =
            MetricsCell::new(BlackboxRecorder::default(), |recorder| {
                metrics_rs::set_default_local_recorder(recorder)
            });

        let env_filter = EnvFilter::builder().from_env_lossy();
        let fmt = tracing_subscriber::fmt::layer().pretty();
        let _tracing_guard = tracing_subscriber::registry()
            .with(env_filter)
            .with(fmt)
            .set_default();

        Telemetry {
            metrics,
            _tracing_guard,
        }
    }

    pub fn metrics(&self) -> &BlackboxRecorder {
        self.metrics.borrow_owner()
    }

    pub fn counter(&self, name: &'static str) -> Option<u64> {
        self.metrics().get(&name.into_counter())
    }

    pub fn gauge(&self, name: &'static str) -> Option<f64> {
        self.metrics().get(&name.into_gauge())
    }
}
