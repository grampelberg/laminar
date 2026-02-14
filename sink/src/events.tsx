import { atom } from 'jotai'

import { configAtom } from '@/config'
import { getLogger } from '@/utils'

import { dbAtom } from './db'

const logger = getLogger(import.meta.url)

const eventStateAtom = atom({
  hasMore: true,
  isLoading: false,
  cursor: undefined,
  rows: [],
})

export const replaceEventsAtom = atom(
  undefined,
  async (_get, _set) => {},
)

export const newEventsAtom = atom(
  undefined,
  async (_get, _set) => {},
)

export const moreEventsAtom = atom(
  undefined,
  async (_get, _set) => {},
)
