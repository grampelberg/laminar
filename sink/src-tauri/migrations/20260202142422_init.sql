PRAGMA foreign_keys = ON;

CREATE TABLE identity (
  pk        INTEGER NOT NULL PRIMARY KEY,
  writer_id TEXT    NOT NULL,
  display_name TEXT,
  pid       INTEGER NOT NULL,
  name      TEXT    NOT NULL,
  hostname  TEXT    NOT NULL,
  start_ms  INTEGER NOT NULL,

  -- if you want to dedupe identity rows instead of inserting duplicates:
  UNIQUE(writer_id, pid, name, hostname, start_ms)
);

CREATE TABLE records (
  id            INTEGER NOT NULL PRIMARY KEY,
  identity_pk   INTEGER NOT NULL REFERENCES identity(pk),

  kind          INTEGER NOT NULL,

  ts_ms         INTEGER NOT NULL,
  received_ms   INTEGER NOT NULL,

  span_id       INTEGER,
  parent_span_id INTEGER,

  target        TEXT    NOT NULL,
  level         INTEGER NOT NULL,
  name          TEXT    NOT NULL,

  file          TEXT,
  line          INTEGER,
  module_path   TEXT,

  fields_json   TEXT    NOT NULL,

  CHECK(kind IN (0,1)),
  CHECK(kind != 1 OR span_id IS NOT NULL)      -- spans must have span_id
);

CREATE TABLE events (
  id            INTEGER NOT NULL PRIMARY KEY,
  identity_pk   INTEGER NOT NULL REFERENCES identity(pk),
  kind          INTEGER NOT NULL,
  received_ms   INTEGER NOT NULL,

  CHECK(kind IN (0,1))
);

-- Unique span ids within an identity (events can reuse span_id; partial index avoids that)
CREATE UNIQUE INDEX spans_unique
  ON records(identity_pk, span_id)
  WHERE kind = 1;

-- Your primary filter pattern
CREATE INDEX records_filter
  ON records(target, level, ts_ms);

-- Useful for building the span tree
CREATE INDEX spans_parent
  ON records(identity_pk, parent_span_id)
  WHERE kind = 1;

-- Useful for “events in span”
CREATE INDEX events_in_span
  ON records(identity_pk, span_id, ts_ms)
  WHERE kind = 0;

CREATE INDEX events_by_identity
  ON events(identity_pk, received_ms);
