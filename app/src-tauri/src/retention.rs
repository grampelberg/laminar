use std::time::Duration as StdDuration;

use chrono::{Duration, Utc};
use eyre::{Result, eyre};
use sqlx::{Pool, Sqlite};
use tauri::{AppHandle, Manager, Wry};

use crate::AppData;

const RETENTION_SWEEP_INTERVAL: StdDuration = StdDuration::from_secs(60);
pub struct RetentionTask {
    handle: AppHandle<Wry>,
}

impl RetentionTask {
    pub fn new(handle: AppHandle<Wry>) -> Self {
        Self { handle }
    }

    #[tracing::instrument(skip_all, err)]
    pub async fn run(self, pool: Pool<Sqlite>) -> Result<()> {
        let mut interval = tokio::time::interval(RETENTION_SWEEP_INTERVAL);
        interval
            .set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

        loop {
            let retention = self.retention()?;
            let retention_ms = retention.num_milliseconds();
            assert!(
                retention_ms >= 0,
                "retention is negative; ignoring cleanup task"
            );

            let cutoff = Utc::now().timestamp_millis() - retention_ms;

            let deleted = sqlx::query!(
                r#"
                DELETE FROM records
                WHERE id IN (
                    SELECT id
                    FROM records
                    WHERE ts_ms < ?
                    ORDER BY ts_ms ASC
                )
                "#,
                cutoff,
            )
            .execute(&pool)
            .await?
            .rows_affected();

            tracing::info!(deleted, cutoff, "retention cleanup");

            interval.tick().await;
        }
    }

    fn retention(&self) -> Result<Duration> {
        let state = self.handle.state::<AppData>();
        let guard = state
            .config
            .read()
            .map_err(|error| eyre!("failed to read config: {error}"))?;
        Ok(guard.settings.retention)
    }
}
