mod parser;

#[cfg(not(target_os = "macos"))]
#[path = "source.rs"]
mod source;
#[cfg(target_os = "macos")]
#[path = "source_macos.rs"]
mod source;

use clap::ValueEnum;
use eyre::Result;
use futures::{Stream, TryStreamExt, pin_mut, stream};
use laminar_stream::{
    Config, SourceProcess, Writer,
    sink::{EmitterOpts, emitter},
};
use parser::Parser;
use tokio::io::{
    self, AsyncBufRead, AsyncBufReadExt, AsyncWrite, AsyncWriteExt, BufReader,
};

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("no source: {0}")]
    NoSource(String),
}

#[derive(clap::Parser, Debug)]
#[command(name = "tap", about = "Forward stdin to deck")]
pub struct Args {
    #[arg(from_global)]
    config: Config,
    #[arg(long, value_enum, default_value_t = Format::Auto)]
    format: Format,
    #[arg(long, value_name = "SOURCE")]
    source: Option<String>,
}

#[derive(Copy, Clone, Debug, Eq, PartialEq, ValueEnum)]
pub enum Format {
    Text,
    Json,
    Auto,
}

pub async fn run(args: Args) -> Result<()> {
    crate::init_logging();

    let process: Option<SourceProcess> = match args.source {
        Some(source) => Some(source.into()),
        None => source::get_sources()?,
    };
    let name = process.clone().map(|p| p.name);

    let (emitter, rx) = emitter(EmitterOpts::default().buffer_size);

    let source = Writer::builder()
        .rx(rx)
        .config(args.config.layer())
        .maybe_source(process.clone())
        .build()
        .run()
        .await?;
    let conv = Parser::new(args.format, name);

    let lines = EchoLines::from_std().stream();
    pin_mut!(lines);

    while let Some(line) = lines.try_next().await? {
        let record = conv.to_record(&line)?;

        if emitter.send(record).is_err() {
            tracing::warn!("writer channel closed, stopping tap");
            break;
        }
    }

    drop(emitter);
    source.await?;

    Ok(())
}

struct EchoLines<Reader, Writer> {
    reader: Reader,
    writer: Writer,
    buffer: Vec<u8>,
}

impl EchoLines<BufReader<io::Stdin>, io::Stdout> {
    fn from_std() -> Self {
        Self {
            reader: BufReader::new(io::stdin()),
            writer: io::stdout(),
            buffer: Vec::new(),
        }
    }
}

impl<Reader, Writer> EchoLines<Reader, Writer>
where
    Reader: AsyncBufRead + Unpin,
    Writer: AsyncWrite + Unpin,
{
    fn stream(self) -> impl Stream<Item = Result<Vec<u8>, std::io::Error>> {
        stream::try_unfold(self, |mut this| async move {
            this.buffer.clear();
            let n = this.reader.read_until(b'\n', &mut this.buffer).await?;
            if n == 0 {
                return Ok(None);
            }

            this.writer.write_all(&this.buffer).await?;
            Ok(Some((std::mem::take(&mut this.buffer), this)))
        })
    }
}
