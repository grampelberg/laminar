mod record;

use std::{str::FromStr, time::{SystemTime, UNIX_EPOCH}};

use iroh::PublicKey;
#[cfg(target_os = "macos")]
use libproc::{bsd_info::BSDInfo, proc_pid};
use serde::{Deserialize, Serialize};
use strum::FromRepr;

pub use crate::api::record::Record;

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

impl FromStr for Level {
    type Err = ();

    fn from_str(level: &str) -> Result<Self, Self::Err> {
        match level.trim().to_ascii_lowercase().as_str() {
            "trace" | "trc" => Ok(Level::Trace),
            "debug" | "dbg" => Ok(Level::Debug),
            "info" | "information" => Ok(Level::Info),
            "warn" | "warning" => Ok(Level::Warn),
            "error" | "err" | "fatal" | "critical" => Ok(Level::Error),
            "off" => Ok(Level::Off),
            _ => Err(()),
        }
    }
}

impl TryFrom<i64> for Level {
    type Error = ();

    fn try_from(level: i64) -> Result<Self, ()> {
        match level {
            0 | 10 => Ok(Level::Trace),
            1 | 20 => Ok(Level::Debug),
            2 | 30 => Ok(Level::Info),
            3 | 40 => Ok(Level::Warn),
            4 | 50 => Ok(Level::Error),
            5 => Ok(Level::Off),
            _ => Err(()),
        }
    }
}

impl TryFrom<u64> for Level {
    type Error = ();

    fn try_from(level: u64) -> Result<Self, ()> {
        i64::try_from(level)
            .map_err(|_| ()) //
            .and_then(Level::try_from)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Deserialize, Serialize)]
pub struct SourceProcess {
    pub pid: u32,
    pub name: String,
    pub start: u64,
}

impl Default for SourceProcess {
    fn default() -> SourceProcess {
        let pid = std::process::id();

        let name = std::env::current_exe()
            .map(|p| {
                p.file_name()
                    .map(|name| name.to_string_lossy().into_owned())
                    .unwrap_or("unknown".to_string())
            })
            .unwrap_or("unknown".to_string());
        let start = now() as u64;

        SourceProcess { pid, name, start }
    }
}

impl From<String> for SourceProcess {
    fn from(name: String) -> Self {
        Self {
            pid: 0,
            name,
            start: now() as u64,
        }
    }
}

#[cfg(target_os = "macos")]
impl TryFrom<u32> for SourceProcess {
    type Error = String;

    fn try_from(pid: u32) -> Result<Self, Self::Error> {
        let info = proc_pid::pidinfo::<BSDInfo>(pid as i32, 0)?;

        Ok(SourceProcess {
            pid,
            name: proc_pid::name(pid as i32)?,
            start: (info.pbi_start_tvsec as u64) * 1_000
                + (info.pbi_start_tvusec as u64) / 1_000,
        })
    }
}

#[cfg(not(target_os = "macos"))]
impl From<u32> for SourceProcess {
    fn from(pid: u32) -> Self {
        SourceProcess {
            pid,
            name: "unknown".to_string(),
            start: 0,
        }
    }
}

fn get_hostname() -> String {
    hostname::get()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or("unknown".to_string())
}

#[derive(Debug, Clone, Deserialize, Serialize, bon::Builder)]
pub struct Claims {
    #[builder(default = get_hostname())]
    pub hostname: String,
    pub display_name: Option<String>,
    pub source: Option<SourceProcess>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct TraceId {
    pub span: Option<u64>,
    pub parent: Option<u64>,
}

#[derive(Debug, bon::Builder)]
pub struct Envelope {
    pub from: PublicKey,
    #[builder(default = now())]
    pub received_at: i64,
    pub record: Record,
}
