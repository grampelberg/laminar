use std::time::{Duration, SystemTime, UNIX_EPOCH};

use blackbox_metrics::{
    CounterValue, KeyExt,
    sampler::{CounterStats, SamplePoint, Series},
};

use crate::{AppData, error, stream::MESSAGE_RECEIVED};

pub(crate) const MESSAGE_SERIES_CAPACITY: usize = 120;
pub(crate) const MESSAGE_SERIES_INTERVAL: Duration = Duration::from_secs(1);

#[tauri::command]
pub fn get_series(
    state: tauri::State<'_, AppData>,
) -> Result<Series<CounterValue, CounterStats>, error::Error> {
    let series = state.metrics.series(&MESSAGE_RECEIVED.into_counter());
    Ok(backfilled_series(series))
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock before unix epoch")
        .as_millis() as u64
}

fn backfilled_series(
    series: Option<Series<CounterValue, CounterStats>>,
) -> Series<CounterValue, CounterStats> {
    let (length, last) = match series.as_ref() {
        Some(current) => {
            let length =
                MESSAGE_SERIES_CAPACITY.saturating_sub(current.points.len());
            let last =
                current.points.first().map_or(now_ms(), |point| point.at_ms);
            (length, last)
        }
        None => (MESSAGE_SERIES_CAPACITY, now_ms()),
    };

    let filled = (1..=length)
        .map(|i| SamplePoint {
            at_ms: last.saturating_sub(
                (i as u64) * (MESSAGE_SERIES_INTERVAL.as_millis() as u64),
            ),
            value: 0,
        })
        .rev();

    match series {
        Some(mut s) => {
            s.points.splice(0..0, filled);

            s
        }
        None => Series {
            points: filled.collect(),
            stats: CounterStats {
                rate: None,
                total: 0,
            },
        },
    }
}
