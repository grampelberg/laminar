use clap::Parser;
use eyre::Result;
use futures::StreamExt;
use inspector::{Config, Reader, sink::ResponseEventKind};

#[derive(Parser, Debug)]
#[command(name = "sink", about = "Run sink server and print received records")]
pub struct Args {
    #[arg(from_global)]
    config: Config,
}

pub async fn run(args: Args) -> Result<()> {
    crate::init_logging();

    let mut reader = Reader::builder()
        .config(args.config.reader())
        .build()
        .await?;
    let mut record_count: u64 = 0;

    tracing::info!(address = %reader.address(), "sink listening");

    while let Some(response) = reader.next().await {
        record_count += 1;
        tracing::debug!(
            response = ?ResponseEventKind::from(&response.event),
            "record_count={record_count}"
        );
    }

    Ok(())
}
