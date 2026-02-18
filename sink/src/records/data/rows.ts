import { atom } from 'jotai'
import { atomEffect } from 'jotai-effect'
import {
  atomWithRefresh,
  atomWithReset,
  atomWithReducer,
  RESET,
  unwrap,
} from 'jotai/utils'
import { type Selectable, sql } from 'kysely'

import { atomWithOwnedDefault } from '@/atom'
import { dbAtom, execute } from '@/db.tsx'
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
  rows: RecordRow[]
}

interface Position {
  top: boolean
  bottom: boolean
}

export type RecordRow = Selectable<Records> & {
  _added?: number
  message?: string
}

export const stateAtom = unwrap(
  atomWithOwnedDefault(async get => await get(pageAtom)),
  prev =>
    prev ?? {
      hasMore: false,
      cursor: undefined,
      rows: [],
    },
)
stateAtom.debugLabel = 'records.state'

const cursorAtom = atomWithReset<RowsCursor | undefined>(undefined)

const pageAtom = atomWithRefresh(async get => {
  const cursor = get(cursorAtom)
  logger('fetch page', cursor)

  const db = await get(dbAtom)
  let query = get(queryAtom)
    .orderBy('ts_ms', 'desc')
    .orderBy('id', 'desc')
    .select([sql<string>`json_extract(fields_json, '$.message')`.as('message')])
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

  return {
    hasMore: (fetched?.length || 0) > ROWS_CHUNK_SIZE,
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
        cursor: page.cursor,
      }
    })
  })()
})

export const refreshAtom = atom(undefined, (_get, set) => {
  set(cursorAtom, RESET)
  set(stateAtom, RESET)
})
