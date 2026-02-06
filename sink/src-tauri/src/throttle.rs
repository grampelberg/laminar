use tokio::time::{Duration, Instant};

#[derive(bon::Builder)]
pub struct Throttle {
    #[builder(default = Duration::from_millis(100))]
    max: Duration,
    #[builder(default = Instant::now())]
    last_run: Instant,
}

impl Default for Throttle {
    fn default() -> Self {
        Self::builder().build()
    }
}

impl Throttle {
    pub fn throttled<F>(&mut self, callback: F) -> tauri::Result<()>
    where
        F: FnOnce() -> tauri::Result<()>,
    {
        let now = Instant::now();
        if now.duration_since(self.last_run) < self.max {
            return Ok(());
        }
        self.last_run = now;

        callback()
    }
}
