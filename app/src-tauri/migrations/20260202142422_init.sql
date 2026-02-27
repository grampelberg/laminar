PRAGMA foreign_keys = ON;

CREATE TABLE identity (
  pk               INTEGER NOT NULL PRIMARY KEY,
  writer_id        TEXT    NOT NULL,
  display_name     TEXT,
  pid              INTEGER,
  process_name     TEXT,
  hostname         TEXT    NOT NULL,
  start_ms         INTEGER,

  -- if you want to dedupe identity rows instead of inserting duplicates:
  UNIQUE(writer_id, pid, process_name, hostname, start_ms)
);

CREATE TABLE records (
  id            INTEGER NOT NULL PRIMARY KEY,
  identity_pk   INTEGER NOT NULL REFERENCES identity(pk),

  kind          INTEGER NOT NULL,

  ts_ms         INTEGER NOT NULL,
  received_ms   INTEGER NOT NULL,

  span_id       INTEGER,
  parent_id     INTEGER,

  source        TEXT,
  level         INTEGER,
  message       TEXT    NOT NULL,

  marker_kind   INTEGER,
  marker_note   TEXT,

  fields_json   TEXT    NOT NULL,

  CHECK(kind IN (0,1))
  CHECK(marker_kind IS NULL OR marker_kind IN (0,1,2,3,4))
  CHECK(kind != 1 OR span_id IS NOT NULL)
);

CREATE TABLE sessions (
  session_id      TEXT    NOT NULL PRIMARY KEY,
  identity_pk     INTEGER NOT NULL REFERENCES identity(pk),
  connected_at    INTEGER NOT NULL,
  last_seen_at    INTEGER NOT NULL,
  disconnected_at INTEGER,
  reason          INTEGER
);

CREATE INDEX records_filter
  ON records(source, level, ts_ms);

CREATE INDEX sessions_by_identity
  ON sessions(identity_pk, last_seen_at);
