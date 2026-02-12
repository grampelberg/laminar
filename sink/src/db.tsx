import Database from '@tauri-apps/plugin-sql'
import { type Getter, type Setter, atom } from 'jotai'
import { focusAtom } from 'jotai-optics'
import { atomWithStorage } from 'jotai/utils'
import {
  type CompiledQuery,
  DummyDriver,
  Kysely,
  type Selectable,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
  sql,
} from 'kysely'
import { config } from 'zod'

import { configAtom } from '@/config.ts'
import { log } from '@/log'
import { useMock } from '@/mock'

import type { DB, Records } from './types/db.ts'

const logger = log(import.meta.url)

export const queryBuilder = new Kysely<DB>({
  dialect: {
    createAdapter: () => new SqliteAdapter(),
    createDriver: () => new DummyDriver(),
    createIntrospector: db => new SqliteIntrospector(db),
    createQueryCompiler: () => new SqliteQueryCompiler(),
  },
})

const dbAtom = atom(async get => {
  const cfg = await get(configAtom)

  logger('config', cfg)

  return await Database.load(cfg.dbUrl)
})

const ROWS_CHUNK_SIZE = 100

export type RecordRow = Selectable<Records> & {
  _added?: number
  message?: string
}

export interface RecordFilter {
  column: keyof RecordRow
  value: unknown
}

interface RowsCursor {
  tsMs: number
  id: number
}

interface RowsPage {
  rows: RecordRow[]
  hasMore: boolean
  nextCursor?: RowsCursor
}

type RowsState = RowsPage & {
  isLoading: boolean
  pendingNewRows: number
}

type RowsUpdateMode = 'replace' | 'merge' | 'append'

const initialRowsState: RowsState = {
  hasMore: true,
  isLoading: false,
  nextCursor: undefined,
  pendingNewRows: 0,
  rows: [],
}

export const rowsStateAtom = atom(initialRowsState)
export const totalRowsAtom = atom(0)
export const pendingNewRowsAtom = focusAtom(rowsStateAtom, optic =>
  optic.prop('pendingNewRows'),
)

const rawFiltersAtom = atomWithStorage<RecordFilter[]>('recordFilters', [])
export const filtersAtom = atom(
  get => get(rawFiltersAtom),
  (
    get,
    set,
    update: RecordFilter[] | ((current: RecordFilter[]) => RecordFilter[]),
  ) => {
    const next =
      typeof update === 'function' ? update(get(rawFiltersAtom)) : update
    set(rawFiltersAtom, next)
    set(replaceRowsAtom)
  },
)

export const positionAtom = atom({ top: true, bottom: false })

const execute = async <Row,>(
  db: Awaited<ReturnType<typeof Database.load>>,
  query: CompiledQuery<unknown>,
): Promise<Row[]> => await db.select<Row[]>(query.sql, [...query.parameters])

type RecordsBaseQuery = ReturnType<typeof baseRecordsQuery>

const baseRecordsQuery = (filters: RecordFilter[]) => {
  let query = queryBuilder.selectFrom('records').where('kind', '=', 0)

  for (const filter of filters) {
    query = query.where(
      filter.column as keyof Records,
      '=',
      filter.value as never,
    )
  }

  return query
}

const getTotalRows = async (
  db: Awaited<ReturnType<typeof Database.load>>,
  base: RecordsBaseQuery,
): Promise<number> => {
  const totalQuery = base.select([sql<number>`COUNT(*)`.as('count')])
  const [{ count }] = await execute<{ count: number }>(db, totalQuery.compile())
  return count
}

// Note: there are a *lot* of assumptions throughout this file wrt ordering. If
// the ordering or cursor ends up changing, it'll break things.
const getRowsPage = async (
  db: Awaited<ReturnType<typeof Database.load>>,
  base: RecordsBaseQuery,
  cursor?: RowsCursor,
): Promise<RowsPage> => {
  let rowQuery = base
    .orderBy('ts_ms', 'desc')
    .orderBy('id', 'desc')
    .select([sql<string>`json_extract(fields_json, '$.message')`.as('message')])
    .selectAll()
    .limit(ROWS_CHUNK_SIZE + 1)

  if (cursor) {
    rowQuery = rowQuery.where(eb =>
      eb.or([
        eb('ts_ms', '<', cursor.tsMs),
        eb.and([eb('ts_ms', '=', cursor.tsMs), eb('id', '<', cursor.id)]),
      ]),
    )
  }

  const fetched = await execute<RecordRow>(db, rowQuery.compile())

  const hasMore = fetched.length > ROWS_CHUNK_SIZE
  const rows = fetched.slice(0, ROWS_CHUNK_SIZE)
  const tail = rows.at(-1)

  return {
    hasMore,
    nextCursor: tail && { id: tail.id, tsMs: tail.ts_ms },
    rows,
  }
}

const markAdded = (prev: RecordRow[], next: RecordRow[]): RecordRow[] => {
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

const applyPage = (
  state: RowsState,
  page: RowsPage,
  mode: RowsUpdateMode,
): RowsState => {
  const { rows: pageRows } = page
  const { pendingNewRows: currentPendingNewRows } = state
  let rows: RecordRow[] = pageRows
  let pendingNewRows = 0

  switch (mode) {
    case 'replace': {
      rows = pageRows
      break
    }
    case 'merge': {
      rows = markAdded(state.rows, pageRows)
      break
    }
    case 'append': {
      rows = [...state.rows, ...pageRows]
      pendingNewRows = currentPendingNewRows
      break
    }
  }

  return {
    hasMore: page.hasMore,
    isLoading: false,
    nextCursor: page.nextCursor,
    pendingNewRows,
    rows,
  }
}

const updateTotal = async (get: Getter, set: Setter) => {
  const db = await get(dbAtom)
  const base = baseRecordsQuery(get(filtersAtom))
  const total = await getTotalRows(db, base)
  set(totalRowsAtom, total)
}

const updateRows = async (get: Getter, set: Setter, mode: RowsUpdateMode) => {
  const state = get(rowsStateAtom)
  if (state.isLoading) {
    return
  }
  if (mode === 'append' && (!state.hasMore || !state.nextCursor)) {
    return
  }

  const db = await get(dbAtom)
  set(rowsStateAtom, { ...state, isLoading: true })

  const base = baseRecordsQuery(get(filtersAtom))
  const cursor = mode === 'append' ? state.nextCursor : undefined
  const page = await getRowsPage(db, base, cursor)
  set(rowsStateAtom, applyPage(state, page, mode))
}

const updateNewRows = async (get: Getter, set: Setter) => {
  await updateTotal(get, set)

  if (!get(positionAtom).top) {
    set(pendingNewRowsAtom, current => current + 1)
    return
  }

  logger('refreshing rows...')

  await updateRows(get, set, 'merge')
}

export const newRowsAtom = atom(
  undefined,
  useMock ? async () => {} : updateNewRows,
)

const replaceRows = async (get: Getter, set: Setter) => {
  await updateTotal(get, set)
  logger('replacing rows...')
  await updateRows(get, set, 'replace')
}

export const replaceRowsAtom = atom(
  undefined,
  useMock ? async () => {} : replaceRows,
)

export const loadMoreRowsAtom = atom(
  undefined,
  useMock
    ? () => {}
    : async (get, set) => {
        logger('loading more rows...')
        await updateRows(get, set, 'append')
      },
)
