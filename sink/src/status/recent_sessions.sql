WITH
  recent_sessions AS (
    SELECT
      sessions.identity_pk,
      coalesce(display_name, hostname, 'unknown') AS name,
      last_seen_at,
      disconnected_at
    FROM
      sessions
      JOIN identity ON sessions.identity_pk = identity.pk
    WHERE
      last_seen_at >= (strftime('%s', 'now') * 1000) - (24 * 60 * 60 * 1000)
  ),
  by_name AS (
    SELECT
      name,
      MAX(last_seen_at) AS last_seen,
      COUNT(
        CASE
          WHEN disconnected_at IS NULL THEN 1
        END
      ) AS current,
      COUNT(DISTINCT identity_pk) AS total
    FROM
      recent_sessions
    GROUP BY
      name
  )
SELECT
  json_object(
    'total',
    coalesce(SUM(current), 0),
    'rows',
    coalesce(
      json_group_array(
        json_object(
          'name',
          name,
          'last_seen',
          last_seen,
          'current',
          current,
          'total',
          total
        )
      ),
      json('[]')
    )
  ) AS payload
FROM
  by_name
