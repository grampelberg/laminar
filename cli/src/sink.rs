use clap::Parser;
use eyre::Result;
use futures::StreamExt;
use laminar_stream::{Config, Reader, sink::ResponseEventKind};

#[derive(Parser, Debug)]
#[command(name = "sink", about = "Run sink server and print received records")]
pub(crate) struct Args {
    #[arg(from_global)]
    config: Config,
}

pub(crate) async fn run(args: Args) -> Result<()> {
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
