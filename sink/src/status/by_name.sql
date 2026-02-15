WITH
  recent AS (
    SELECT
      writer_id,
      coalesce(display_name, hostname, 'unknown') AS name,
      kind,
      received_ms
    FROM
      events
      JOIN identity ON events.identity_pk = identity.pk
    WHERE
      received_ms >= strftime('%s', 'now') - 24 * 60 * 60
  ),
  by_writer AS (
    SELECT
      writer_id,
      name,
      max(received_ms) AS LAST,
      max(
        CASE
          WHEN kind = 0 THEN received_ms
        END
      ) AS last_connect,
      max(
        CASE
          WHEN kind = 1 THEN received_ms
        END
      ) AS last_disconnect
    FROM
      recent
    GROUP BY
      writer_id
  ),
  by_name AS (
    SELECT
      name,
      MAX(LAST) AS last_seen,
      SUM(
        CASE
          WHEN last_connect IS NOT NULL
          AND (
            last_disconnect IS NULL
            OR last_connect > last_disconnect
          ) THEN 1
          ELSE 0
        END
      ) AS current_connections,
      COUNT(*) AS total_clients
    FROM
      by_writer
    GROUP BY
      name
  )
SELECT
  json_object(
    'totalConnected',
    coalesce(SUM(current_connections), 0),
    'rows',
    coalesce(
      json_group_array(
        json_object(
          'name',
          name,
          'last_seen',
          last_seen,
          'current_connections',
          current_connections,
          'total_clients',
          total_clients
        )
      ),
      json('[]')
    )
  ) AS payload
FROM
  by_name
