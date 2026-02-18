import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import type { Records } from '@/types/db.ts'

import { refreshAtom } from './rows.ts'

export interface RecordFilter {
  column: keyof Records
  value: unknown
}

// This must have `getOnInit` set to true, otherwise the initial value is used
// and then onMount the actual value is set. This causes things like pageAtom()
// to re-evaluate.
const rawFiltersAtom = atomWithStorage<RecordFilter[]>(
  'recordFilters',
  [],
  undefined,
  {
    getOnInit: true,
  },
)

rawFiltersAtom.debugPrivate = true

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
    set(refreshAtom)
  },
)
