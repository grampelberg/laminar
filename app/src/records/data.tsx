import { atom } from 'jotai'
import { atomWithRefresh, unwrap } from 'jotai/utils'
import { type Selectable, sql } from 'kysely'

import { dbAtom, queryBuilder, execute } from '@/db.tsx'
import { filtersAtom } from '@/records/data/filter.ts'
import type { Identity } from '@/types/db.ts'
import { getLogger } from '@/utils.ts'

import type { RecordRow } from './data/rows.ts'

export {
  __test,
  markerAtom,
  type MarkerInput,
  MarkerKind,
  positionAtom,
  stateAtom,
  type RecordRow,
} from './data/rows.ts'
export { filtersAtom, type RecordFilter } from './data/filter.ts'

const logger = getLogger(import.meta.url)

export const queryAtom = atom(get => {
  let query = queryBuilder.selectFrom('records').where('kind', '=', 0)

  for (const filter of get(filtersAtom)) {
    query =
      filter.value === null
        ? query.where(filter.column, 'is', filter.value as never)
        : query.where(filter.column, '=', filter.value as never)
  }

  return query
})
queryAtom.debugPrivate = true

export const totalAtom = unwrap(
  atomWithRefresh(async get => {
    const db = await get(dbAtom)
    const query = get(queryAtom).select([sql<number>`COUNT(*)`.as('count')])
    const rows = await execute<{ count: number }>(db, query.compile())
    if (rows.length === 0) {
      return 0
    }

    return rows[0].count
  }),
  prev => prev ?? 0,
)

export const selectedAtom = atom<RecordRow | undefined>(undefined)

export const identityAtom = unwrap(
  atom(async get => {
    const row = get(selectedAtom)
    if (!row) {
      return undefined
    }

    const db = await get(dbAtom)
    const identityQuery = queryBuilder
      .selectFrom('identity')
      .selectAll()
      .where('pk', '=', row.identity_pk)
      .limit(1)

    const identities = await execute<Selectable<Identity>>(
      db,
      identityQuery.compile(),
    )

    return identities[0]
  }),
  prev => prev ?? undefined,
)
