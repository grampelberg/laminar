#![allow(unreachable_pub)]

mod loadgen;
mod sink;
mod tap;

use clap::{Parser, Subcommand};
use eyre::Result;
use laminar_stream::Config;
use tracing::level_filters::LevelFilter;
use tracing_subscriber::{EnvFilter, prelude::*};

type BoxError = Box<dyn std::error::Error + Send + Sync>;

const CONFIG_DEFAULT_SENTINEL: &str = "__default__";

fn parse_config(raw: &str) -> Result<Config, BoxError> {
    let cfg = if raw == CONFIG_DEFAULT_SENTINEL {
        Config::load()?
    } else {
        Config::load_from_path(raw)?
    };

    Ok(cfg)
}

#[derive(Parser, Debug)]
#[command(name = "cli", about = "laminar-stream CLI")]
struct Cli {
    #[arg(
        long,
        value_name = "PATH",
        global = true,
        default_value = CONFIG_DEFAULT_SENTINEL,
        value_parser = parse_config
    )]
    config: Config,
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand, Debug)]
enum Command {
    Tap(tap::Args),
    Loadgen(loadgen::Args),
    Sink(sink::Args),
}

pub(crate) fn init_logging() {
    let env_filter = EnvFilter::builder()
        .with_default_directive(LevelFilter::INFO.into())
        .from_env_lossy();

    let fmt_layer = tracing_subscriber::fmt::layer().pretty();

    tracing_subscriber::registry()
        .with(env_filter)
        .with(fmt_layer)
        .init();
}

#[tokio::main]
async fn main() -> Result<()> {
    color_eyre::install()?;

    let cli = Cli::parse();

    match cli.command {
        Command::Tap(args) => tap::run(args).await,
        Command::Loadgen(args) => loadgen::run(args).await,
        Command::Sink(args) => sink::run(args).await,
    }
}
