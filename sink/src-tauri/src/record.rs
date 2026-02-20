use inspector::{
    sink::{DisconnectReason, Identity, ResponseEvent},
    Claims, Record,
};
use sqlx::{Pool, Row, Sqlite};

pub trait WithSql {
    async fn insert(&self, pool: &Pool<Sqlite>) -> sqlx::Result<()>;
}

pub async fn close_open_sessions(pool: &Pool<Sqlite>) -> sqlx::Result<u64> {
    let result = sqlx::query(
        r#"
        UPDATE sessions
        SET disconnected_at = last_seen_at,
            reason = ?
        WHERE disconnected_at IS NULL
        "#,
    )
    .bind(DisconnectReason::ServerShutdown as i64)
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
    sqlx::query(
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
    )
    .bind(identity_pk)
    .bind(body.kind.clone() as i64)
    .bind(body.timestamp as i64)
    .bind(received_at as i64)
    .bind(
        body.trace
            .as_ref()
            .and_then(|trace| trace.span)
            .map(|v| v as i64),
    )
    .bind(
        body.trace
            .as_ref()
            .and_then(|trace| trace.parent)
            .map(|v| v as i64),
    )
    .bind(body.source.as_deref())
    .bind(body.level.clone().map(|level| level as i64))
    .bind(&body.message)
    .bind(&body.fields)
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
    sqlx::query(
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
    )
    .bind(session_id)
    .bind(identity_pk)
    .bind(received_at)
    .bind(received_at)
    .bind(disconnected_at)
    .bind(reason)
    .execute(pool)
    .await?;

    Ok(())
}

impl WithSql for Identity<Claims> {
    async fn insert(&self, pool: &Pool<Sqlite>) -> sqlx::Result<()> {
        let writer_id = self.observed.to_string();
        let pid = self
            .assertion
            .source
            .as_ref()
            .map(|source| source.pid as i64);
        let process_name = self
            .assertion
            .source
            .as_ref()
            .map(|source| source.name.as_str());
        let start_ms = self
            .assertion
            .source
            .as_ref()
            .map(|source| source.start as i64);

        sqlx::query(
            r#"
                INSERT OR IGNORE INTO identity (writer_id, display_name, pid, process_name, hostname, start_ms)
                VALUES (?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(writer_id.as_str())
        .bind(self.assertion.display_name.as_deref())
        .bind(pid)
        .bind(process_name)
        .bind(&self.assertion.hostname)
        .bind(start_ms)
        .execute(pool)
        .await?;

        Ok(())
    }
}

impl WithSql for inspector::sink::Response<Claims, Record> {
    async fn insert(&self, pool: &Pool<Sqlite>) -> sqlx::Result<()> {
        self.identity.insert(pool).await?;
        let writer_id = self.identity.observed.to_string();
        let identity_pk: i64 = sqlx::query(
            r#"
            SELECT pk
            FROM identity
            WHERE writer_id = ?
              AND pid IS ?
              AND process_name IS ?
              AND hostname = ?
              AND start_ms IS ?
            "#,
        )
        .bind(writer_id)
        .bind(
            self.identity
                .assertion
                .source
                .as_ref()
                .map(|source| source.pid as i64),
        )
        .bind(
            self.identity
                .assertion
                .source
                .as_ref()
                .map(|source| source.name.as_str()),
        )
        .bind(&self.identity.assertion.hostname)
        .bind(
            self.identity
                .assertion
                .source
                .as_ref()
                .map(|source| source.start as i64),
        )
        .fetch_one(pool)
        .await?
        .get("pk");

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
