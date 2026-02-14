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
import { getLogger } from '@/utils'

import type { DB, Records } from './types/db.ts'

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
  const cfg = await get(configAtom)

  logger('config', cfg)

  return await Database.load(cfg.dbUrl)
})

export const execute = async <Row,>(
  db: Awaited<ReturnType<typeof Database.load>>,
  query: CompiledQuery<unknown>,
): Promise<Row[]> => await db.select<Row[]>(query.sql, [...query.parameters])
