use inspector::{
    Claims, Record, sink::Identity, sink::ResponseEvent,
    sink::ResponseEventKind,
};
use sqlx::{sqlite::SqliteRow, Pool, Row, Sqlite};

pub trait WithSql {
    async fn insert(&self, pool: &Pool<Sqlite>) -> sqlx::Result<SqliteRow>;
}

async fn insert_record_data(
    pool: &Pool<Sqlite>,
    identity_pk: i64,
    received_at: i64,
    body: &Record,
) -> sqlx::Result<SqliteRow> {
    sqlx::query(
        r#"
        INSERT INTO records (
          identity_pk,
          kind,
          ts_ms,
          received_ms,
          span_id,
          parent_span_id,
          target,
          level,
          name,
          file,
          line,
          module_path,
          fields_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING id
        "#,
    )
    .bind(identity_pk)
    .bind(body.kind.clone() as i64)
    .bind(body.timestamp as i64)
    .bind(received_at as i64)
    .bind(body.span_id.map(|v| v as i64))
    .bind(body.parent.map(|v| v as i64))
    .bind(&body.metadata.target)
    .bind(body.metadata.level.clone() as i64)
    .bind(&body.metadata.name)
    .bind(body.metadata.file.as_deref())
    .bind(body.metadata.line.map(|v| v as i64))
    .bind(body.metadata.module_path.as_deref())
    .bind(&body.fields)
    .fetch_one(pool)
    .await
}

async fn insert_connection_event(
    pool: &Pool<Sqlite>,
    identity_pk: i64,
    received_at: i64,
    kind: i64,
) -> sqlx::Result<SqliteRow> {
    sqlx::query(
        r#"
        INSERT INTO events (
          identity_pk,
          kind,
          received_ms
        )
        VALUES (?, ?, ?)
        RETURNING id
        "#,
    )
    .bind(identity_pk)
    .bind(kind)
    .bind(received_at as i64)
    .fetch_one(pool)
    .await
}

impl WithSql for Identity<Claims> {
    async fn insert(&self, pool: &Pool<Sqlite>) -> sqlx::Result<SqliteRow> {
        let writer_id = self.observed.to_string();

        sqlx::query(
            r#"
                INSERT OR IGNORE INTO identity (writer_id, display_name, pid, name, hostname, start_ms)
                VALUES (?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(writer_id.as_str())
        .bind(self.assertion.display_name.as_deref())
        .bind(self.assertion.process.pid as i64)
        .bind(&self.assertion.process.name)
        .bind(&self.assertion.process.hostname)
        .bind(self.assertion.process.start as i64)
        .execute(pool)
        .await?;

        sqlx::query(
            r#"
            SELECT pk
            FROM identity
            WHERE writer_id = ? AND pid = ? AND name = ? AND hostname = ? AND start_ms = ?
            "#,
        )
        .bind(writer_id)
        .bind(self.assertion.process.pid as i64)
        .bind(&self.assertion.process.name)
        .bind(&self.assertion.process.hostname)
        .bind(self.assertion.process.start as i64)
        .fetch_one(pool)
        .await
    }
}

impl WithSql for inspector::sink::Response<Claims, Record> {
    async fn insert(&self, pool: &Pool<Sqlite>) -> sqlx::Result<SqliteRow> {
        let identity_pk: i64 = self.identity.insert(pool).await?.get("pk");

        match &self.event {
            ResponseEvent::Data(body) => {
                insert_record_data(pool, identity_pk, self.received_at, body).await
            }
            event @ (ResponseEvent::Connect | ResponseEvent::Disconnect) => {
                insert_connection_event(
                    pool,
                    identity_pk,
                    self.received_at,
                    ResponseEventKind::from(event) as i64,
                )
                .await
            }
        }
    }
}
