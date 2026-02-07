use inspector::{Process, Record};
use sqlx::{sqlite::SqliteRow, Pool, Row, Sqlite};

pub trait WithSql {
    async fn insert(&self, pool: &Pool<Sqlite>) -> sqlx::Result<SqliteRow>;
}

impl WithSql for Process {
    async fn insert(&self, pool: &Pool<Sqlite>) -> sqlx::Result<SqliteRow> {
        sqlx::query(
            r#"
                INSERT OR IGNORE INTO processes (pid, name, hostname, start_ms)
                VALUES (?, ?, ?, ?)
            "#,
        )
        .bind(self.pid as i64)
        .bind(&self.name)
        .bind(&self.hostname)
        .bind(self.start as i64)
        .execute(pool)
        .await?;

        sqlx::query(
            r#"
            SELECT pk
            FROM processes
            WHERE pid = ? AND name = ? AND hostname = ? AND start_ms = ?
            "#,
        )
        .bind(self.pid as i64)
        .bind(&self.name)
        .bind(&self.hostname)
        .bind(self.start as i64)
        .fetch_one(pool)
        .await
    }
}

impl WithSql for inspector::sink::Response<Process, Record> {
    async fn insert(&self, pool: &Pool<Sqlite>) -> sqlx::Result<SqliteRow> {
        let process_pk: i64 =
            self.identity.assertion.insert(pool).await?.get("pk");

        let writer_id = self.identity.observed.to_string();

        sqlx::query(
            r#"
            INSERT INTO records (
              process_pk,
              kind,
              ts_ms,
              received_ms,
              writer_id,
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
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id
            "#,
        )
        .bind(process_pk)
        .bind(self.body.kind.clone() as i64)
        .bind(self.body.timestamp as i64)
        .bind(self.received_at as i64)
        .bind(writer_id)
        .bind(self.body.span_id.map(|v| v as i64))
        .bind(self.body.parent.map(|v| v as i64))
        .bind(&self.body.metadata.target)
        .bind(self.body.metadata.level.clone() as i64)
        .bind(&self.body.metadata.name)
        .bind(self.body.metadata.file.as_deref())
        .bind(self.body.metadata.line.map(|v| v as i64))
        .bind(self.body.metadata.module_path.as_deref())
        .bind(&self.body.fields)
        .fetch_one(pool)
        .await
    }
}
