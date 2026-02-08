use std::time::Duration;

use clap::Parser;
use eyre::{Result, eyre};
use futures::{
    future::join_all,
    pin_mut,
    stream::{self, StreamExt},
};
use inspector::{Config, InspectorLayer};
use petname::petname;
use tokio::time;
use tracing::level_filters::LevelFilter;
use tracing_subscriber::{EnvFilter, prelude::*};

#[derive(Parser, Debug)]
#[command(name = "loadgen", about = "Load generator CLI")]
struct Args {
    #[arg(long, value_name = "PATH")]
    inspector_config: Option<String>,
    #[arg(long, default_value_t = 10, value_name = "LOGS_PER_SECOND")]
    rate: u64,
    #[arg(long, default_value_t = 25, value_name = "WORDS")]
    max_words: u8,
    #[arg(long, default_value_t = 1, value_name = "N")]
    threads: u16,
    #[arg(long, default_value_t = 10, value_name = "PERCENT")]
    jitter_percent: u8,
}

#[tokio::main]
async fn main() -> Result<()> {
    color_eyre::install()?;

    let args = Args::parse();
    if args.rate == 0 {
        return Err(eyre!("--rate must be > 0"));
    }
    if args.max_words == 0 {
        return Err(eyre!("--max-words must be > 0"));
    }
    if args.threads == 0 {
        return Err(eyre!("--threads must be > 0"));
    }
    if args.jitter_percent > 100 {
        return Err(eyre!("--jitter-percent must be <= 100"));
    }

    let config = args
        .inspector_config
        .map(|p| Config::load_from_path(p).expect("can load config").layer());

    let (layer, writer) =
        InspectorLayer::builder().maybe_config(config).build()?;
    let env_filter = EnvFilter::builder()
        .with_default_directive(LevelFilter::INFO.into())
        .from_env_lossy();

    let fmt_layer = tracing_subscriber::fmt::layer().pretty();

    tracing_subscriber::registry()
        .with(env_filter)
        .with(fmt_layer)
        .with(layer)
        .init();

    writer.run().await?;

    let base_delay =
        Duration::from_secs_f64(args.threads as f64 / args.rate as f64);

    let max_words = args.max_words;
    let jitter_percent = args.jitter_percent;
    let mut handles = Vec::with_capacity(args.threads as usize);

    for worker in 0..args.threads {
        let handle = tokio::spawn(async move {
            let delays = stream::repeat(base_delay)
                .map(move |base| {
                    let base_nanos = base.as_nanos();
                    let range = (base_nanos * jitter_percent as u128 / 100)
                        .max(1) as i128;

                    let jitter = rand::random_range(-range..=range);
                    let delay_nanos =
                        (base_nanos as i128 + jitter).max(1) as u64;
                    Duration::from_nanos(delay_nanos)
                })
                .then(|delay| async move {
                    time::sleep(delay).await;
                });
            pin_mut!(delays);

            while let Some(()) = delays.next().await {
                let word_count = rand::random_range(1..=max_words);
                let message = petname(word_count, " ")
                    .unwrap_or_else(|| "petname exhausted words".to_string());

                match rand::random_range(0..5) {
                    0 => {
                        tracing::trace!(target: "loadgen::roach", worker, message)
                    }
                    1 => {
                        tracing::debug!(target: "loadgen::ruggedly::admirable::yellowtail", worker, message)
                    }
                    2 => {
                        tracing::info!(target: "loadgen::informally::importantly", worker, message)
                    }
                    3 => {
                        tracing::warn!(target: "loadgen::immutably::amorally::southerly::unarguably::partially", worker, message)
                    }
                    _ => {
                        tracing::error!(target: "loadgen::unpleasantly::languidly::fortuitously::scandalously::reticently::mindlessly::insecurely", worker, message)
                    }
                }
            }
        });
        handles.push(handle);
    }

    join_all(handles).await;

    Ok(())
}
