use laminar_stream::{
    Claims, Record,
    sink::{DisconnectReason, Identity, ResponseEvent},
};
use sqlx::{Pool, Sqlite};

pub trait WithSql {
    async fn insert(&self, pool: &Pool<Sqlite>) -> sqlx::Result<()>;
}

struct InsertRecordParams<'a> {
    identity_pk: i64,
    kind: i64,
    ts_ms: i64,
    received_ms: i64,
    span_id: Option<i64>,
    parent_id: Option<i64>,
    source: Option<&'a str>,
    level: Option<i64>,
    message: &'a str,
    fields_json: &'a str,
}

impl<'a> InsertRecordParams<'a> {
    fn from_record(
        identity_pk: i64,
        received_ms: i64,
        body: &'a Record,
    ) -> Self {
        Self {
            identity_pk,
            kind: body.kind.clone() as i64,
            ts_ms: body.timestamp,
            received_ms,
            span_id: body
                .trace
                .as_ref()
                .and_then(|trace| trace.span)
                .map(|value| value as i64),
            parent_id: body
                .trace
                .as_ref()
                .and_then(|trace| trace.parent)
                .map(|value| value as i64),
            source: body.source.as_deref(),
            level: body.level.clone().map(|current| current as i64),
            message: body.message.as_str(),
            fields_json: body.fields.as_str(),
        }
    }

    async fn execute(&self, pool: &Pool<Sqlite>) -> sqlx::Result<()> {
        sqlx::query!(
            r#"
            INSERT INTO records (
              identity_pk,
              kind,
              ts_ms,
              received_ms,
              span_id,
              parent_id,
              source,
              level,
              message,
              fields_json
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
            self.identity_pk,
            self.kind,
            self.ts_ms,
            self.received_ms,
            self.span_id,
            self.parent_id,
            self.source,
            self.level,
            self.message,
            self.fields_json,
        )
        .execute(pool)
        .await?;

        Ok(())
    }
}

struct IdentityInsertParams<'a> {
    writer_id: &'a str,
    display_name: Option<&'a str>,
    pid: Option<i64>,
    process_name: Option<&'a str>,
    hostname: &'a str,
    start_ms: Option<i64>,
}

impl<'a> IdentityInsertParams<'a> {
    fn from_identity(
        writer_id: &'a str,
        identity: &'a Identity<Claims>,
    ) -> Self {
        Self {
            writer_id,
            display_name: identity.assertion.display_name.as_deref(),
            pid: identity
                .assertion
                .source
                .as_ref()
                .map(|source| source.pid as i64),
            process_name: identity
                .assertion
                .source
                .as_ref()
                .map(|source| source.name.as_str()),
            hostname: identity.assertion.hostname.as_str(),
            start_ms: identity
                .assertion
                .source
                .as_ref()
                .map(|source| source.start as i64),
        }
    }

    async fn execute(&self, pool: &Pool<Sqlite>) -> sqlx::Result<()> {
        sqlx::query!(
            r#"
                INSERT OR IGNORE INTO identity (writer_id, display_name, pid, process_name, hostname, start_ms)
                VALUES (?, ?, ?, ?, ?, ?)
            "#,
            self.writer_id,
            self.display_name,
            self.pid,
            self.process_name,
            self.hostname,
            self.start_ms,
        )
        .execute(pool)
        .await?;

        Ok(())
    }
}

struct IdentitySelectParams<'a> {
    writer_id: &'a str,
    pid: Option<i64>,
    process_name: Option<&'a str>,
    hostname: &'a str,
    start_ms: Option<i64>,
}

impl<'a> IdentitySelectParams<'a> {
    fn from_identity(
        writer_id: &'a str,
        identity: &'a Identity<Claims>,
    ) -> Self {
        Self {
            writer_id,
            pid: identity
                .assertion
                .source
                .as_ref()
                .map(|source| source.pid as i64),
            process_name: identity
                .assertion
                .source
                .as_ref()
                .map(|source| source.name.as_str()),
            hostname: identity.assertion.hostname.as_str(),
            start_ms: identity
                .assertion
                .source
                .as_ref()
                .map(|source| source.start as i64),
        }
    }

    async fn identity_pk(&self, pool: &Pool<Sqlite>) -> sqlx::Result<i64> {
        sqlx::query_scalar!(
            r#"
            SELECT pk
            FROM identity
            WHERE writer_id = ?
              AND pid IS ?
              AND process_name IS ?
              AND hostname = ?
              AND start_ms IS ?
            "#,
            self.writer_id,
            self.pid,
            self.process_name,
            self.hostname,
            self.start_ms,
        )
        .fetch_one(pool)
        .await
    }
}

pub async fn close_open_sessions(pool: &Pool<Sqlite>) -> sqlx::Result<u64> {
    let result = sqlx::query!(
        r#"
        UPDATE sessions
        SET disconnected_at = last_seen_at,
            reason = ?
        WHERE disconnected_at IS NULL
        "#,
        DisconnectReason::ServerShutdown as i64,
    )
    .execute(pool)
    .await?;

    Ok(result.rows_affected())
}

async fn insert_record_data(
    pool: &Pool<Sqlite>,
    identity_pk: i64,
    received_at: i64,
    body: &Record,
) -> sqlx::Result<()> {
    metrics::counter!("db.insert", "table" => "records").increment(1);

    InsertRecordParams::from_record(identity_pk, received_at, body)
        .execute(pool)
        .await?;

    Ok(())
}

async fn upsert_connected_session(
    pool: &Pool<Sqlite>,
    session_id: &str,
    identity_pk: i64,
    received_at: i64,
    disconnected_at: Option<i64>,
    reason: Option<i64>,
) -> sqlx::Result<()> {
    metrics::counter!("db.insert", "table" => "sessions").increment(1);

    sqlx::query!(
        r#"
        INSERT INTO sessions (
          session_id,
          identity_pk,
          connected_at,
          last_seen_at,
          disconnected_at,
          reason
        )
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
          last_seen_at = excluded.last_seen_at,
          disconnected_at = excluded.disconnected_at,
          reason = excluded.reason
        "#,
        session_id,
        identity_pk,
        received_at,
        received_at,
        disconnected_at,
        reason,
    )
    .execute(pool)
    .await?;

    Ok(())
}

impl WithSql for Identity<Claims> {
    async fn insert(&self, pool: &Pool<Sqlite>) -> sqlx::Result<()> {
        metrics::counter!("db.insert", "table" => "identity").increment(1);

        IdentityInsertParams::from_identity(
            self.observed.to_string().as_str(),
            self,
        )
        .execute(pool)
        .await?;

        Ok(())
    }
}

impl WithSql for laminar_stream::sink::Response<Claims, Record> {
    async fn insert(&self, pool: &Pool<Sqlite>) -> sqlx::Result<()> {
        self.identity.insert(pool).await?;
        let writer_id = self.identity.observed.to_string();

        metrics::counter!("db.select", "table" => "identity").increment(1);
        let identity_pk = IdentitySelectParams::from_identity(
            writer_id.as_str(),
            &self.identity,
        )
        .identity_pk(pool)
        .await?;

        let (disconnected_at, reason) = match &self.event {
            ResponseEvent::Disconnect(reason) => {
                (Some(self.received_at), Some(*reason as i64))
            }
            _ => (None, None),
        };

        upsert_connected_session(
            pool,
            &self.session_id.to_string(),
            identity_pk,
            self.received_at,
            disconnected_at,
            reason,
        )
        .await?;

        if let ResponseEvent::Data(body) = &self.event {
            insert_record_data(pool, identity_pk, self.received_at, body)
                .await?;
        }

        Ok(())
    }
}
