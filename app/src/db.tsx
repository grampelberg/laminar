import Database from '@tauri-apps/plugin-sql'
import { atom } from 'jotai'
import {
  type CompiledQuery,
  DummyDriver,
  Kysely,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
} from 'kysely'

import { stateAtom } from '@/state.ts'
import { getLogger } from '@/utils'

import type { DB } from './types/db.ts'

const logger = getLogger(import.meta.url)

export const queryBuilder = new Kysely<DB>({
  dialect: {
    createAdapter: () => new SqliteAdapter(),
    createDriver: () => new DummyDriver(),
    createIntrospector: db => new SqliteIntrospector(db),
    createQueryCompiler: () => new SqliteQueryCompiler(),
  },
})

export const dbAtom = atom(async get => {
  const {
    db: { url },
  } = await get(stateAtom)

  return await Database.load(url)
})

dbAtom.debugPrivate = true

export const execute = async <Row,>(
  db: Awaited<ReturnType<typeof Database.load>>,
  query: CompiledQuery<unknown>,
): Promise<Row[]> => await db.select<Row[]>(query.sql, [...query.parameters])
