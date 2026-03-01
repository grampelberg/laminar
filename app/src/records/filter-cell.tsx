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

  const addFilter = (event: MouseEvent) => {
    event.stopPropagation()
    setFilters(filter)
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
