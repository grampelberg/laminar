import { Slot } from '@radix-ui/react-slot'
import { useSetAtom } from 'jotai'
import type { ComponentProps, MouseEvent, ReactNode } from 'react'

import { cn } from '@/lib/utils'
import { filtersAtom, type RecordFilter } from '@/records/data.tsx'

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

  const slotProps: ComponentProps<typeof Slot> = {
    className: cn('cursor-pointer '),
    onClick: addFilter,
    title: `Filter by ${String(filter.column)}`,
  }

  return <Slot {...slotProps}>{children}</Slot>
}
