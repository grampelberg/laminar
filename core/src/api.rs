mod record;

use std::{str::FromStr, time::{SystemTime, UNIX_EPOCH}};

use iroh::PublicKey;
#[cfg(target_os = "macos")]
use libproc::{bsd_info::BSDInfo, proc_pid};
use serde::{Deserialize, Serialize};
use strum::FromRepr;

pub use crate::api::record::Record;

#[must_use]
pub fn now() -> i64 {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis();
    i64::try_from(millis).unwrap_or(i64::MAX)
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
        match *level {
            tracing::Level::TRACE => Self::Trace,
            tracing::Level::DEBUG => Self::Debug,
            tracing::Level::INFO => Self::Info,
            tracing::Level::WARN => Self::Warn,
            tracing::Level::ERROR => Self::Error,
        }
    }
}

impl FromStr for Level {
    type Err = ();

    fn from_str(level: &str) -> Result<Self, Self::Err> {
        match level.trim().to_ascii_lowercase().as_str() {
            "trace" | "trc" => Ok(Self::Trace),
            "debug" | "dbg" => Ok(Self::Debug),
            "info" | "information" => Ok(Self::Info),
            "warn" | "warning" => Ok(Self::Warn),
            "error" | "err" | "fatal" | "critical" => Ok(Self::Error),
            "off" => Ok(Self::Off),
            _ => Err(()),
        }
    }
}

impl TryFrom<i64> for Level {
    type Error = ();

    fn try_from(level: i64) -> Result<Self, ()> {
        match level {
            0 | 10 => Ok(Self::Trace),
            1 | 20 => Ok(Self::Debug),
            2 | 30 => Ok(Self::Info),
            3 | 40 => Ok(Self::Warn),
            4 | 50 => Ok(Self::Error),
            5 => Ok(Self::Off),
            _ => Err(()),
        }
    }
}

impl TryFrom<u64> for Level {
    type Error = ();

    fn try_from(level: u64) -> Result<Self, ()> {
        i64::try_from(level)
            .map_err(|_| ()) //
            .and_then(Self::try_from)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Deserialize, Serialize)]
pub struct SourceProcess {
    pub pid: u32,
    pub name: String,
    pub start: u64,
}

impl Default for SourceProcess {
    fn default() -> Self {
        let pid = std::process::id();

        let name = std::env::current_exe()
            .map_or_else(|_| "unknown".to_string(), |p| {
                p.file_name()
                    .map_or_else(
                        || "unknown".to_string(),
                        |name| name.to_string_lossy().into_owned(),
                    )
            });
        let start = u64::try_from(now()).unwrap_or_default();

        Self { pid, name, start }
    }
}

impl From<String> for SourceProcess {
    fn from(name: String) -> Self {
        Self {
            pid: 0,
            name,
            start: u64::try_from(now()).unwrap_or_default(),
        }
    }
}

#[cfg(target_os = "macos")]
impl TryFrom<u32> for SourceProcess {
    type Error = String;

    fn try_from(pid: u32) -> Result<Self, Self::Error> {
        let pid_i32 = i32::try_from(pid)
            .map_err(|_| format!("pid out of range for i32: {pid}"))?;
        let info = proc_pid::pidinfo::<BSDInfo>(pid_i32, 0)?;

        Ok(Self {
            pid,
            name: proc_pid::name(pid_i32)?,
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
    hostname::get().map_or_else(
        |_| "unknown".to_string(),
        |n| n.to_string_lossy().into_owned(),
    )
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
