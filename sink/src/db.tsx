import Database from '@tauri-apps/plugin-sql'
import { type Getter, type Setter, atom } from 'jotai'
import { focusAtom } from 'jotai-optics'
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

const dbAtom = atom(async () => await Database.load('sqlite:inspector.db'))
const ROWS_CHUNK_SIZE = 100

export type RecordRow = Selectable<Records> & { message?: string }

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

type RowsUpdateMode = 'replace' | 'append'

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

export const filtersAtom = atom<RecordFilter[]>([])

export const positionAtom = atom({ top: true, bottom: false })

const execute = async <Row,>(
  db: Awaited<ReturnType<typeof Database.load>>,
  query: CompiledQuery<unknown>,
): Promise<Row[]> => await db.select<Row[]>(query.sql, [...query.parameters])

const baseRecordsQuery = () =>
  queryBuilder.selectFrom('records').where('kind', '=', 0)

const getTotalRows = async (
  db: Awaited<ReturnType<typeof Database.load>>,
): Promise<number> => {
  const totalQuery = baseRecordsQuery().select([
    sql<number>`COUNT(*)`.as('count'),
  ])
  const [{ count }] = await execute<{ count: number }>(db, totalQuery.compile())
  return count
}

const getRowsPage = async (
  db: Awaited<ReturnType<typeof Database.load>>,
  cursor?: RowsCursor,
): Promise<RowsPage> => {
  const base = baseRecordsQuery()

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

const dedupeRowsById = (rows: RecordRow[]): RecordRow[] => {
  const seen = new Set<number>()
  const deduped: RecordRow[] = []

  for (const row of rows) {
    if (seen.has(row.id)) {
      continue
    }
    seen.add(row.id)
    deduped.push(row)
  }

  return deduped
}

const applyPage = (
  state: RowsState,
  page: RowsPage,
  mode: RowsUpdateMode,
): RowsState => ({
  hasMore: page.hasMore,
  isLoading: false,
  nextCursor: page.nextCursor,
  pendingNewRows: mode === 'replace' ? 0 : state.pendingNewRows,
  rows:
    mode === 'replace'
      ? page.rows
      : dedupeRowsById([...state.rows, ...page.rows]),
})

const updateTotal = async (get: Getter, set: Setter) => {
  const db = await get(dbAtom)
  const total = await getTotalRows(db)
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

  const cursor = mode === 'replace' ? undefined : state.nextCursor
  const page = await getRowsPage(db, cursor)
  set(rowsStateAtom, applyPage(state, page, mode))
}

export const refreshRowsAtom = atom(
  undefined,
  useMock
    ? () => {}
    : async (get, set) => {
        await updateTotal(get, set)

        if (!get(positionAtom).top) {
          set(pendingNewRowsAtom, current => current + 1)
          return
        }

        logger('refreshing rows...')

        await updateRows(get, set, 'replace')
      },
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
