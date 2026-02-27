import { atom } from 'jotai'
import { atomEffect } from 'jotai-effect'
import {
  atomWithRefresh,
  atomWithReset,
  atomWithReducer,
  RESET,
  unwrap,
} from 'jotai/utils'
import { type Selectable } from 'kysely'
import { z } from 'zod'

import { atomWithOwnedDefault } from '@/atom'
import { dbAtom, execute, queryBuilder } from '@/db.tsx'
import { queryAtom, totalAtom } from '@/records/data.tsx'
import { streamAtom } from '@/stream.tsx'
import type { Records } from '@/types/db.ts'
import { getLogger } from '@/utils.ts'

const logger = getLogger(import.meta.url)

const ROWS_CHUNK_SIZE = 100

export const __test = { ROWS_CHUNK_SIZE }

interface RowsCursor {
  id: number
  tsMs: number
}

interface RowsPage {
  cursor?: RowsCursor
  hasMore: boolean
  loaded: boolean
  rows: RecordRow[]
}

interface Position {
  top: boolean
  bottom: boolean
}

export type RecordRow = Selectable<Records> & {
  _added?: number
}

export const stateAtom = unwrap(
  atomWithOwnedDefault(async get => await get(pageAtom)),
  prev =>
    prev ?? {
      hasMore: false,
      loaded: false,
      cursor: undefined,
      rows: [],
    },
)
stateAtom.debugLabel = 'records.state'

const cursorAtom = atomWithReset<RowsCursor | undefined>(undefined)

const pageAtom = atomWithRefresh(async get => {
  const cursor = get(cursorAtom)

  const db = await get(dbAtom)
  let query = get(queryAtom)
    .orderBy('ts_ms', 'desc')
    .orderBy('id', 'desc')
    .selectAll()
    .limit(ROWS_CHUNK_SIZE + 1)

  if (cursor) {
    query = query.where(eb =>
      eb.or([
        eb('ts_ms', '<', cursor.tsMs),
        eb.and([eb('ts_ms', '=', cursor.tsMs), eb('id', '<', cursor.id)]),
      ]),
    )
  }

  const fetched = await execute<RecordRow>(db, query.compile())
  const tail = fetched?.at(-1)

  logger('fetched page', fetched?.length)

  return {
    hasMore: (fetched?.length || 0) > ROWS_CHUNK_SIZE,
    loaded: true,
    cursor: tail && { id: tail.id, tsMs: tail.ts_ms },
    rows: fetched?.slice(0, ROWS_CHUNK_SIZE) || [],
  }
})

export const positionAtom = atomWithReducer<Position, Position | undefined>(
  { top: false, bottom: false },
  (prev, next = prev) => {
    if (prev.top === next.top && prev.bottom === next.bottom) {
      return prev
    }
    return next
  },
)

export const loadMoreAtom = atomEffect((get, set) => {
  void (async () => {
    const { top, bottom } = get(positionAtom)
    const { hasMore, cursor } = get.peek(stateAtom)

    const loadMore = bottom && !top && hasMore

    if (!loadMore) {
      return
    }

    set(cursorAtom, cursor)
    const page = await get(pageAtom)

    set(stateAtom, async (promise: Promise<RowsPage>) => {
      const state = await promise
      return {
        rows: [...state.rows, ...page.rows],
        hasMore: page.hasMore,
        loaded: true,
        cursor: page.cursor,
      }
    })
  })()
})

export const markAdded = (
  prev: RecordRow[],
  next: RecordRow[],
): RecordRow[] => {
  const head = prev.at(0)
  if (!head) {
    return next
  }

  const prevAdded = prev.reduce((acc, row) => {
    if (row._added) {
      acc.set(row.id, row._added)
    }

    return acc
  }, new Map())

  const now = Date.now()
  for (const row of next) {
    if (row.id > head.id && row.ts_ms >= head.ts_ms) {
      row._added = now
    } else if (prevAdded.has(row.id)) {
      row._added = prevAdded.get(row.id)
    }
  }

  return next
}

export const streamUpdateAtom = atomEffect((get, set) => {
  void (async () => {
    const { top } = get(positionAtom)
    const signal = get(streamAtom)
    const shouldUpdate = top && signal > 0

    if (!shouldUpdate) {
      return
    }

    set(cursorAtom, undefined)
    set(pageAtom)
    set(totalAtom)

    const page = await get(pageAtom)

    set(stateAtom, async (promise: Promise<RowsPage>) => {
      const state = await promise

      return {
        rows: markAdded(state.rows, page.rows),
        hasMore: page.hasMore,
        loaded: true,
        cursor: page.cursor,
      }
    })
  })()
})

export const refreshAtom = atom(undefined, (_get, set) => {
  set(cursorAtom, RESET)
  set(stateAtom, RESET)
})

export const refreshRowAtom = atom(undefined, async (get, set, id: number) => {
  const db = await get(dbAtom)
  const query = queryBuilder
    .selectFrom('records')
    .selectAll()
    .where('id', '=', id)
    .limit(1)
    .compile()
  const [next] = await execute<RecordRow>(db, query)

  if (!next) {
    return
  }

  set(stateAtom, async promise => {
    const state = await promise
    const idx = state.rows.findIndex(row => row.id === next.id)
    if (idx === -1) {
      return state
    }

    state.rows[idx] = next

    return { ...state, rows: [...state.rows] }
  })
})

export const MarkerKind = {
  info: 0,
  warning: 1,
  error: 2,
  success: 3,
  note: 4,
} as const

const zMarkerKind = z.enum(MarkerKind)

export type MarkerKind = z.infer<typeof zMarkerKind>

export interface MarkerInput {
  id: number
  kind?: MarkerKind | null
  note?: string
}

export const markerAtom = atom(
  undefined,
  async (get, set, { id, kind, note }: MarkerInput) => {
    const db = await get(dbAtom)
    const query = queryBuilder
      .updateTable('records')
      .set({
        ...(kind !== undefined && { marker_kind: kind }),
        ...(note !== undefined && { marker_note: note }),
      })
      .where('id', '=', id)
      .compile()

    await db.execute(query.sql, [...query.parameters])
    set(refreshRowAtom, id)
  },
)
