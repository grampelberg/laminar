use std::fmt;

use serde::{Deserialize, Serialize};
use tracing::field::Visit;

use crate::api::{Kind, Level, TraceId, now};

type JsonFields = serde_json::Map<String, serde_json::Value>;

#[derive(Debug, Deserialize, Serialize, bon::Builder)]
pub struct Record {
    #[builder(default = Kind::Event)]
    pub kind: Kind,
    #[builder(default = now())]
    pub timestamp: i64,
    pub level: Option<Level>,
    pub source: Option<String>,
    pub message: String,
    pub trace: Option<TraceId>,
    #[builder(into)]
    pub fields: String,
}

impl Record {
    pub fn encode(&self) -> Result<Vec<u8>, serde_json::Error> {
        serde_json::to_vec(self)
    }

    pub fn decode(data: &[u8]) -> Result<Self, serde_json::Error> {
        serde_json::from_slice(data)
    }

    pub fn from_span(
        attrs: &tracing::span::Attributes<'_>,
        id: &tracing::span::Id,
    ) -> Self {
        let mut visitor = FieldVisitor::default();
        attrs.record(&mut visitor);

        let message = attrs.metadata().name().to_string();
        let fields = attrs.metadata().merge_fields(visitor.raw);

        Self::builder()
            .kind(Kind::Span)
            .level(attrs.metadata().level().into())
            .source(attrs.metadata().target().to_string())
            .trace(TraceId {
                span: Some(id.into_u64()),
                parent: attrs.parent().map(tracing::span::Id::into_u64),
            })
            .message(message)
            .fields(serde_json::Value::Object(fields).to_string())
            .build()
    }

    #[must_use]
    pub fn from_event(event: &tracing::Event<'_>) -> Self {
        let mut visitor = FieldVisitor::default();
        event.record(&mut visitor);
        let message = visitor
            .raw
            .get("message")
            .map(|f| f.as_str().map(str::to_owned).unwrap_or_default())
            .unwrap_or_default();

        let fields = event.metadata().merge_fields(visitor.raw);

        Self::builder()
            .kind(Kind::Event)
            .timestamp(now())
            .level(event.metadata().level().into())
            .source(event.metadata().target().to_string())
            .trace(TraceId {
                span: None,
                parent: event.parent().map(tracing::Id::into_u64),
            })
            .message(message)
            .fields(serde_json::Value::Object(fields).to_string())
            .build()
    }
}

trait MergeFields {
    fn merge_fields(&self, source: JsonFields) -> JsonFields;
}

impl MergeFields for tracing::Metadata<'_> {
    fn merge_fields(&self, mut source: JsonFields) -> JsonFields {
        source.insert(
            "tracing".to_string(),
            serde_json::json!({
                "name": self.name(),
                "target": self.target(),
                "file": self.file(),
                "line": self.line(),
                "module_path": self.module_path(),
            }),
        );

        source
    }
}

#[derive(Default)]
struct FieldVisitor {
    raw: serde_json::Map<String, serde_json::Value>,
}

impl Visit for FieldVisitor {
    fn record_f64(&mut self, field: &tracing::field::Field, value: f64) {
        let value = serde_json::Number::from_f64(value)
            .map_or(serde_json::Value::Null, serde_json::Value::Number);
        self.raw.insert(field.name().to_string(), value);
    }

    fn record_i64(&mut self, field: &tracing::field::Field, value: i64) {
        self.raw
            .insert(field.name().to_string(), serde_json::Value::from(value));
    }

    fn record_u64(&mut self, field: &tracing::field::Field, value: u64) {
        self.raw
            .insert(field.name().to_string(), serde_json::Value::from(value));
    }

    fn record_bool(&mut self, field: &tracing::field::Field, value: bool) {
        self.raw
            .insert(field.name().to_string(), serde_json::Value::from(value));
    }

    fn record_str(&mut self, field: &tracing::field::Field, value: &str) {
        self.raw
            .insert(field.name().to_string(), serde_json::Value::from(value));
    }

    fn record_debug(
        &mut self,
        field: &tracing::field::Field,
        value: &dyn fmt::Debug,
    ) {
        self.raw.insert(
            field.name().to_string(),
            serde_json::Value::String(format!("{value:?}")),
        );
    }

    #[cfg(feature = "valuable")]
    fn record_value(
        &mut self,
        field: &tracing::field::Field,
        value: valuable::Value<'_>,
    ) {
        self.raw.insert(
            field.name().to_string(),
            serde_json::Value::String(format!("{value:?}")),
        );
    }

    fn record_error(
        &mut self,
        field: &tracing::field::Field,
        value: &(dyn std::error::Error + 'static),
    ) {
        self.raw.insert(
            field.name().to_string(),
            serde_json::Value::String(value.to_string()),
        );
    }
}
