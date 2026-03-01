import { useSetAtom } from 'jotai'
import type { MouseEvent, ReactNode } from 'react'

import { cn } from '@/lib/utils'

import { filtersAtom, type RecordFilter } from './data/filter'

export const FilterCell = ({
  children,
  filter,
}: {
  children: ReactNode
  filter: RecordFilter
}) => {
  const setFilters = useSetAtom(filtersAtom)
  const matchesFilter = (current: RecordFilter) =>
    current.column === filter.column && Object.is(current.value, filter.value)

  const addFilter = (event: MouseEvent) => {
    event.stopPropagation()
    setFilters(current => [...current.filter(i => !matchesFilter(i)), filter])
  }

  const valueLabel =
    filter.value === undefined ? 'empty' : String(filter.value)

  return (
    <button
      type="button"
      className={cn('contents cursor-pointer')}
      onClick={addFilter}
      title={`Filter by ${String(filter.column)}: ${valueLabel}`}
      aria-label={`Filter by ${String(filter.column)}: ${valueLabel}`}
    >
      {children}
    </button>
  )
}
