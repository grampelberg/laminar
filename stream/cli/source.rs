use eyre::Result;
use inspector::SourceProcess;

use super::Error;

pub fn get_sources() -> Result<Option<SourceProcess>, Error> {
    tracing::error!("no source process candidates found");
    Ok(None)
}
