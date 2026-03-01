import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import type { Records } from '@/types/db.ts'

import { refreshAtom } from './rows.ts'

export interface RecordFilter {
  column: keyof Records
  value: unknown
}

const isSameFilter = (left: RecordFilter, right: RecordFilter) =>
  left.column === right.column && Object.is(left.value, right.value)

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
  (get, set, next: RecordFilter) => {
    const current = get(rawFiltersAtom)
    set(rawFiltersAtom, [...current.filter(item => !isSameFilter(item, next)), next])
    set(refreshAtom)
  },
)

export const removeFilterAtAtom = atom(
  undefined,
  (get, set, index: number) => {
    set(
      rawFiltersAtom,
      get(rawFiltersAtom).filter((_, itemIndex) => itemIndex !== index),
    )
    set(refreshAtom)
  },
)
