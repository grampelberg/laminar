use std::time::{SystemTime, UNIX_EPOCH};

use iroh::PublicKey;
use serde::{Deserialize, Serialize};
use strum::FromRepr;
use tracing::field::Visit;

use crate::FieldVisitor;

pub(crate) fn now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64
}

#[repr(u8)]
#[derive(Debug, Clone, Deserialize, Serialize, FromRepr)]
pub enum Kind {
    Event = 0,
    Span = 1,
}

#[repr(u8)]
#[derive(Debug, Clone, Deserialize, Serialize, FromRepr)]
pub enum Level {
    Trace = 0,
    Debug = 1,
    Info = 2,
    Warn = 3,
    Error = 4,
    Off = 5,
}

impl From<&tracing::Level> for Level {
    fn from(level: &tracing::Level) -> Self {
        match level {
            &tracing::Level::TRACE => Level::Trace,
            &tracing::Level::DEBUG => Level::Debug,
            &tracing::Level::INFO => Level::Info,
            &tracing::Level::WARN => Level::Warn,
            &tracing::Level::ERROR => Level::Error,
        }
    }
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Metadata {
    pub name: String,
    pub target: String,
    pub level: Level,
    pub file: Option<String>,
    pub line: Option<u32>,
    pub module_path: Option<String>,
}

impl From<&tracing::Metadata<'_>> for Metadata {
    fn from(meta: &tracing::Metadata<'_>) -> Self {
        Metadata {
            name: meta.name().to_string(),
            target: meta.target().to_string(),
            level: meta.level().into(),
            file: meta.file().map(|f| f.to_string()),
            line: meta.line(),
            module_path: meta.module_path().map(|m| m.to_string()),
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Process {
    pub pid: u32,
    pub name: String,
    pub hostname: String,
    pub start: u64,
}

impl Default for Process {
    fn default() -> Process {
        let pid = std::process::id();
        let hostname = hostname::get()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or("unknown".to_string());
        let name = std::env::current_exe()
            .map(|p| {
                p.file_name()
                    .map(|name| name.to_string_lossy().into_owned())
                    .unwrap_or("unknown".to_string())
            })
            .unwrap_or("unknown".to_string());
        let start = now() as u64;

        Process {
            pid,
            name,
            hostname,
            start,
        }
    }
}

// TODO: move into its own crate
#[derive(Debug, Deserialize, Serialize, bon::Builder)]
pub struct Record {
    pub span_id: Option<u64>,
    pub kind: Kind,
    #[builder(default = now())]
    pub timestamp: i64,
    #[builder(into)]
    pub metadata: Metadata,
    pub parent: Option<u64>,
    pub fields: String,
}

impl Record {
    pub fn encode(&self) -> Result<Vec<u8>, serde_json::Error> {
        serde_json::to_vec(self)
    }

    pub fn decode(data: &[u8]) -> Result<Self, serde_json::Error> {
        serde_json::from_slice(data)
    }
}

impl<S> RecordBuilder<S>
where
    S: record_builder::State,
{
    pub fn fields_visitor<F>(
        self,
        record: F,
    ) -> RecordBuilder<record_builder::SetFields<S>>
    where
        F: FnOnce(&mut dyn Visit),
        S::Fields: record_builder::IsUnset,
    {
        let mut visitor = FieldVisitor::default();
        record(&mut visitor);
        let fields = serde_json::to_string(&visitor.fields)
            .unwrap_or_else(|_| "{}".to_string());
        self.fields(fields)
    }
}

#[derive(Debug, bon::Builder)]
pub struct Envelope {
    pub from: PublicKey,
    #[builder(default = now())]
    pub received_at: i64,
    pub record: Record,
}
