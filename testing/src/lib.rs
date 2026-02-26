use ::metrics as metrics_rs;
use blackbox_metrics::{BlackboxRecorder, KeyExt, MetricsRead};
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
    tracing_guard: DefaultGuard,
}

impl std::fmt::Debug for Telemetry {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Telemetry").finish_non_exhaustive()
    }
}

impl Default for Telemetry {
    fn default() -> Self {
        Self::new()
    }
}

impl Telemetry {
    #[must_use]
    pub fn new() -> Self {
        color_eyre::install().ok();

        if let Ok(handle) = Handle::try_current() {
            assert!(
                handle.runtime_flavor() == RuntimeFlavor::CurrentThread,
                "Telemetry can only be used with a current-thread runtime"
            );
        }

        let metrics =
            MetricsCell::new(BlackboxRecorder::default(), |recorder| {
                metrics_rs::set_default_local_recorder(recorder)
            });

        let env_filter = EnvFilter::builder().from_env_lossy();
        let fmt = tracing_subscriber::fmt::layer().pretty();
        let tracing_guard = tracing_subscriber::registry()
            .with(env_filter)
            .with(fmt)
            .set_default();

        Self {
            metrics,
            tracing_guard,
        }
    }

    #[must_use]
    pub fn metrics(&self) -> &BlackboxRecorder {
        let _ = &self.tracing_guard;
        self.metrics.borrow_owner()
    }

    #[must_use]
    pub fn counter(&self, name: &'static str) -> Option<u64> {
        self.metrics().get(&name.into_counter())
    }

    #[must_use]
    pub fn gauge(&self, name: &'static str) -> Option<f64> {
        self.metrics().get(&name.into_gauge())
    }
}
