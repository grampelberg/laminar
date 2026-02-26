import { invoke } from '@tauri-apps/api/core'
import { atomEffect } from 'jotai-effect'
import { atomWithRefresh, unwrap } from 'jotai/utils'
import { sql } from 'kysely'

import { atomWithPeriodicRefresh } from '@/atom'
import { dbAtom, execute, queryBuilder } from '@/db'
import { streamAtom } from '@/stream.tsx'
import { getLogger } from '@/utils'

import sessionsQuery from './recent_sessions.sql?raw'

const logger = getLogger(import.meta.url)

export interface SessionRow {
  current: number
  last_seen: number
  name: string
  total: number
}

export interface SessionsResult {
  rows: SessionRow[]
  total: number
}

export interface Status {
  dbSize: number
}

export interface IngestPoint {
  at_ms: number
  value: number
}

export interface IngestStats {
  rate?: number
  total: number
}

export interface IngestSeries {
  points: IngestPoint[]
  stats: IngestStats
}

const INGEST_REFRESH_MS = 1000
const EMPTY_INGEST: IngestSeries = {
  points: [],
  stats: {
    rate: undefined,
    total: 0,
  },
}

export const statusAtom = unwrap(
  atomWithRefresh(async () => await invoke<Status>('get_status')),
  prev =>
    prev ?? {
      dbSize: 0,
    },
)
statusAtom.debugLabel = 'statusAtom'

export const ingestAtom = unwrap(
  atomWithPeriodicRefresh(async () => {
    try {
      return await invoke<IngestSeries>('get_series')
    } catch {
      return EMPTY_INGEST
    }
  }, INGEST_REFRESH_MS),
  prev => prev ?? EMPTY_INGEST,
)
ingestAtom.debugLabel = 'ingestAtom'

export const sessionsAtom = atomWithRefresh(async get => {
  const db = await get(dbAtom)
  const [val] = await db.select<{ payload?: string }[]>(sessionsQuery)
  if (!val?.payload) {
    return { rows: [], total: 0 } satisfies SessionsResult
  }

  return JSON.parse(val.payload) as SessionsResult
})
sessionsAtom.debugLabel = 'sessionsAtom'

export const totalRowsAtom = unwrap(
  atomWithRefresh(async get => {
    const db = await get(dbAtom)
    const query = queryBuilder
      .selectFrom('records')
      .select([sql<number>`COUNT(*)`.as('count')])
    const rows = await execute<{ count: number }>(db, query.compile())
    return rows[0]?.count ?? 0
  }),
  prev => prev ?? 0,
)

export const statusUpdateAtom = atomEffect((get, set) => {
  void (async () => {
    const signal = get(streamAtom)
    const shouldUpdate = signal > 0

    if (!shouldUpdate) {
      return
    }

    set(sessionsAtom)
    set(statusAtom)
    set(totalRowsAtom)
  })()
})
