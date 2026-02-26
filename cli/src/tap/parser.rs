use chrono::{DateTime, Utc};
use eyre::Result;
use laminar_stream::{Kind, Level, Record};

use super::Format;

pub(super) struct Parser {
    format: Format,
    source: Option<String>,
}

impl Parser {
    pub(super) const fn new(format: Format, source: Option<String>) -> Self {
        Self { format, source }
    }

    pub(crate) fn to_record(&self, line: &[u8]) -> Result<Record> {
        match self.format {
            Format::Text => Ok(self.as_text(line)),
            Format::Json => self.as_json(line),
            Format::Auto => {
                let first_non_ws = line
                    .iter()
                    .copied()
                    .find(|byte| !byte.is_ascii_whitespace());
                if matches!(first_non_ws, Some(b'{' | b'[')) {
                    return self.as_json(line);
                }
                Ok(self.as_text(line))
            }
        }
    }

    fn as_text(&self, line: &[u8]) -> Record {
        Record::builder()
            .maybe_source(self.source.clone())
            .message(line.to_content())
            .fields("{}")
            .build()
    }

    fn as_json(&self, line: &[u8]) -> Result<Record> {
        let parsed: serde_json::Map<String, serde_json::Value> =
            serde_json::from_slice(line)?;

        let message = parsed.message().unwrap_or_else(|| line.to_content());
        let source = parsed.source().or_else(|| self.source.clone());

        Ok(Record::builder()
            .kind(Kind::Event)
            .maybe_source(source)
            .maybe_level(parsed.level())
            .timestamp(
                parsed
                    .timestamp()
                    .unwrap_or_else(|| Utc::now().timestamp_millis()),
            )
            .message(message)
            .fields(line.to_content())
            .build())
    }
}

trait ToContent {
    fn to_content(&self) -> String;
}

impl ToContent for &[u8] {
    fn to_content(&self) -> String {
        String::from_utf8_lossy(
            self.strip_suffix(b"\n")
                .unwrap_or(self)
                .strip_suffix(b"\r")
                .unwrap_or(self),
        )
        .to_string()
    }
}

const fn normalize_epoch(raw: i64) -> i64 {
    let abs = raw.saturating_abs();
    if abs >= 1_000_000_000_000_000_000 {
        raw / 1_000_000
    } else if abs >= 1_000_000_000_000_000 {
        raw / 1_000
    } else if abs >= 1_000_000_000_000 {
        raw
    } else {
        raw.saturating_mul(1_000)
    }
}

trait ToFields {
    fn timestamp(&self) -> Option<i64>;
    fn message(&self) -> Option<String>;
    fn level(&self) -> Option<Level>;
    fn source(&self) -> Option<String>;
}

impl ToFields for serde_json::Map<String, serde_json::Value> {
    fn message(&self) -> Option<String> {
        self.get("message")
            .or_else(|| self.get("msg"))
            .or_else(|| self.get("body"))
            .or_else(|| {
                self.get("fields")
                    .and_then(serde_json::Value::as_object)
                    .and_then(|fields| fields.get("message"))
            })
            .and_then(serde_json::Value::as_str)
            .map(str::to_owned)
    }

    fn timestamp(&self) -> Option<i64> {
        let value = self
            .get("timestamp")
            .or_else(|| self.get("time"))
            .or_else(|| self.get("ts"))?;

        match value {
            serde_json::Value::Number(num) => {
                if let Some(value) = num.as_i64() {
                    return Some(normalize_epoch(value));
                }
                if let Some(value) = num.as_u64() {
                    return i64::try_from(value).ok().map(normalize_epoch);
                }
                if let Some(value) = num.as_f64() {
                    if !value.is_finite() {
                        return None;
                    }
                    let rounded = value.round();
                    let parsed = format!("{rounded:.0}").parse::<i64>().ok()?;
                    return Some(normalize_epoch(parsed));
                }
                None
            }
            serde_json::Value::String(s) => DateTime::parse_from_rfc3339(s)
                .or_else(|_| DateTime::parse_from_rfc2822(s))
                .map(|dt| dt.with_timezone(&Utc).timestamp_millis())
                .ok(),
            _ => None,
        }
    }

    fn level(&self) -> Option<Level> {
        let value = self
            .get("level")
            .or_else(|| self.get("severity"))
            .or_else(|| self.get("severity_text"))
            .or_else(|| self.get("log.level"))?;

        match value {
            serde_json::Value::String(s) => {
                s.parse::<Level>().ok().or_else(|| {
                    s.parse::<i64>().ok().and_then(|n| n.try_into().ok())
                })
            }
            serde_json::Value::Number(num) => {
                if let Some(i) = num.as_i64() {
                    return i.try_into().ok();
                }
                if let Some(u) = num.as_u64() {
                    return u.try_into().ok();
                }
                None
            }
            _ => None,
        }
    }

    fn source(&self) -> Option<String> {
        self.get("target")
            .and_then(serde_json::Value::as_str)
            .map(str::to_owned)
    }
}
