use std::time::Duration;

use clap::{Parser, ValueEnum};
use eyre::{Result, eyre};
use futures::{
    future::join_all,
    pin_mut,
    stream::{self, StreamExt},
};
use laminar_stream::{Config, InspectorLayer};
use petname::petname;
use tokio::time;
use tracing::level_filters::LevelFilter;
use tracing_subscriber::{EnvFilter, prelude::*};

#[derive(Parser, Debug)]
#[command(name = "loadgen", about = "Load generator CLI")]
pub(crate) struct Args {
    #[arg(from_global)]
    config: Config,
    #[arg(long, default_value_t = true, action = clap::ArgAction::Set)]
    emit: bool,
    #[arg(long, value_enum, default_value_t = OutputFormat::Pretty)]
    format: OutputFormat,
    #[arg(long, default_value_t = 10, value_name = "LOGS_PER_SECOND")]
    rate: u64,
    #[arg(long, default_value_t = 25, value_name = "WORDS")]
    max_words: u8,
    #[arg(long, default_value_t = 1, value_name = "N")]
    threads: u16,
    #[arg(long, default_value_t = 10, value_name = "PERCENT")]
    jitter_percent: u8,
}

#[derive(Copy, Clone, Debug, Eq, PartialEq, ValueEnum)]
pub(crate) enum OutputFormat {
    Full,
    Compact,
    Pretty,
    Json,
}

pub(crate) async fn run(args: Args) -> Result<()> {
    if args.rate == 0 {
        return Err(eyre!("--rate must be > 0"));
    }
    let rate_u32 = u32::try_from(args.rate)
        .map_err(|_| eyre!("--rate must be <= {}", u32::MAX))?;
    if args.max_words == 0 {
        return Err(eyre!("--max-words must be > 0"));
    }
    if args.threads == 0 {
        return Err(eyre!("--threads must be > 0"));
    }
    if args.jitter_percent > 100 {
        return Err(eyre!("--jitter-percent must be <= 100"));
    }

    let (layer, writer) = if args.emit {
        let (layer, writer) = InspectorLayer::builder()
            .config(args.config.layer())
            .build()?;
        (Some(layer), Some(writer))
    } else {
        (None, None)
    };

    let env_filter = EnvFilter::builder()
        .with_default_directive(LevelFilter::INFO.into())
        .from_env_lossy()
        .add_directive("loadgen=trace".parse().expect("is valid"));

    let fmt_layer = match args.format {
        OutputFormat::Full => tracing_subscriber::fmt::layer().boxed(),
        OutputFormat::Compact => {
            tracing_subscriber::fmt::layer().compact().boxed()
        }
        OutputFormat::Pretty => {
            tracing_subscriber::fmt::layer().pretty().boxed()
        }
        OutputFormat::Json => tracing_subscriber::fmt::layer().json().boxed(),
    };

    tracing_subscriber::registry()
        .with(env_filter)
        .with(fmt_layer)
        .with(layer)
        .init();

    if let Some(writer) = writer {
        writer.run().await?;
    }

    let base_delay =
        Duration::from_secs_f64(f64::from(args.threads) / f64::from(rate_u32));

    let max_words = args.max_words;
    let jitter_percent = args.jitter_percent;
    let mut handles = Vec::with_capacity(args.threads as usize);

    for worker in 0..args.threads {
        let handle = tokio::spawn(async move {
            let delays = stream::repeat(base_delay)
                .map(move |base| {
                    let base_nanos = base.as_nanos();
                    let range_u128 =
                        (base_nanos * u128::from(jitter_percent) / 100).max(1);
                    let range = i128::try_from(range_u128).unwrap_or(i128::MAX);

                    let jitter = rand::random_range(-range..=range);
                    let base_i128 =
                        i128::try_from(base_nanos).unwrap_or(i128::MAX);
                    let delay_nanos_i128 = (base_i128 + jitter).max(1);
                    let delay_nanos =
                        u64::try_from(delay_nanos_i128).unwrap_or(u64::MAX);
                    Duration::from_nanos(delay_nanos)
                })
                .then(|delay| async move {
                    time::sleep(delay).await;
                });
            pin_mut!(delays);

            while delays.next().await == Some(()) {
                let word_count = rand::random_range(1..=max_words);
                let message = petname(word_count, " ")
                    .unwrap_or_else(|| "petname exhausted words".to_string());

                match rand::random_range(0..5) {
                    0 => {
                        tracing::trace!(target: "loadgen::roach", worker, message);
                    }
                    1 => {
                        tracing::debug!(target: "loadgen::ruggedly::admirable::yellowtail", worker, message);
                    }
                    2 => {
                        tracing::info!(target: "loadgen::informally::importantly", worker, message);
                    }
                    3 => {
                        tracing::warn!(target: "loadgen::immutably::amorally::southerly::unarguably::partially", worker, message);
                    }
                    _ => {
                        tracing::error!(target: "loadgen::unpleasantly::languidly::fortuitously::scandalously::reticently::mindlessly::insecurely", worker, message);
                    }
                }
            }
        });
        handles.push(handle);
    }

    join_all(handles).await;
    Ok(())
}
