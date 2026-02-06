import Database from '@tauri-apps/plugin-sql'
import { atom, type Getter, type Setter } from 'jotai'
import { focusAtom } from 'jotai-optics'
import {
  DummyDriver,
  Kysely,
  type Selectable,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
  sql,
} from 'kysely'

import type { DB, Records } from './types/db.ts'

const queryBuilder = new Kysely<DB>({
  dialect: {
    createAdapter: () => new SqliteAdapter(),
    createDriver: () => new DummyDriver(),
    createIntrospector: db => new SqliteIntrospector(db),
    createQueryCompiler: () => new SqliteQueryCompiler(),
  },
})

const dbAtom = atom(async _ => await Database.load('sqlite:inspector.db'))
const ROWS_CHUNK_SIZE = 100

export type RecordRow = Selectable<Records> & { message: string | null }

interface RowsCursor {
  tsMs: number
  id: number
}

interface RowsPage {
  rows: RecordRow[]
  hasMore: boolean
  nextCursor: RowsCursor | null
}

interface RowsState {
  rows: RecordRow[]
  hasMore: boolean
  isLoading: boolean
  nextCursor: RowsCursor | null
  pendingNewRows: number
}

const initialRowsState: RowsState = {
  rows: [],
  hasMore: true,
  isLoading: false,
  nextCursor: null,
  pendingNewRows: 0,
}

export const rowsStateAtom = atom(initialRowsState)
export const isNearTopAtom = atom(true)
export const pendingNewRowsAtom = focusAtom(rowsStateAtom, optic =>
  optic.prop('pendingNewRows'),
)

const getRowsPage = async (
  db: Awaited<ReturnType<typeof Database.load>>,
  cursor: RowsCursor | null,
): Promise<RowsPage> => {
  let stmtBuilder = queryBuilder
    .selectFrom('records')
    .where('kind', '=', 0)
    .orderBy('ts_ms', 'desc')
    .orderBy('id', 'desc')
    .select([sql<string>`json_extract(fields_json, '$.message')`.as('message')])
    .selectAll()
    .limit(ROWS_CHUNK_SIZE + 1)

  if (cursor) {
    stmtBuilder = stmtBuilder.where(eb =>
      eb.or([
        eb('ts_ms', '<', cursor.tsMs),
        eb.and([eb('ts_ms', '=', cursor.tsMs), eb('id', '<', cursor.id)]),
      ]),
    )
  }

  const stmt = stmtBuilder.compile()
  const fetched: RecordRow[] = await db.select(stmt.sql, [...stmt.parameters])
  const hasMore = fetched.length > ROWS_CHUNK_SIZE
  const rows = hasMore ? fetched.slice(0, ROWS_CHUNK_SIZE) : fetched
  const tail = rows.length > 0 ? rows[rows.length - 1] : null

  return {
    rows,
    hasMore,
    nextCursor: tail ? { tsMs: tail.ts_ms, id: tail.id } : null,
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

type RowsUpdateMode = 'replace' | 'append'

const applyPage = (
  state: RowsState,
  page: RowsPage,
  mode: RowsUpdateMode,
): RowsState => ({
  rows:
    mode === 'replace' ? page.rows : dedupeRowsById([...state.rows, ...page.rows]),
  hasMore: page.hasMore,
  isLoading: false,
  nextCursor: page.nextCursor,
  pendingNewRows: mode === 'replace' ? 0 : state.pendingNewRows,
})

const updateRowsState = async (
  get: Getter,
  set: Setter,
  mode: RowsUpdateMode,
) => {
  const state = get(rowsStateAtom)
  if (state.isLoading) {
    return
  }
  if (mode === 'append' && (!state.hasMore || !state.nextCursor)) {
    return
  }

  const db = await get(dbAtom)
  set(rowsStateAtom, { ...state, isLoading: true })

  const cursor = mode === 'replace' ? null : state.nextCursor
  const page = await getRowsPage(db, cursor)
  set(rowsStateAtom, applyPage(state, page, mode))
}

export const refreshRowsAtom = atom(null, async (get, set) => {
  if (!get(isNearTopAtom)) {
    set(pendingNewRowsAtom, current => current + 1)
    return
  }

  await updateRowsState(get, set, 'replace')
})

export const loadMoreRowsAtom = atom(null, async (get, set) => {
  await updateRowsState(get, set, 'append')
})
