import { Slot } from '@radix-ui/react-slot'
import { useSetAtom } from 'jotai'
import { isEqual } from 'lodash-es'
import type { ComponentProps, MouseEvent } from 'react'

import { filtersAtom, type RecordFilter } from '@/db'
import { cn } from '@/lib/utils'

export const FilterCell = ({
  children,
  filter,
}: {
  children: React.ReactNode
  filter: RecordFilter
}) => {
  const setFilters = useSetAtom(filtersAtom)

  const addFilter = (event: MouseEvent) => {
    event.stopPropagation()
    setFilters(current => [...current.filter(i => !isEqual(i, filter)), filter])
  }

  const slotProps: ComponentProps<typeof Slot> = {
    className: cn('cursor-pointer '),
    onClick: addFilter,
    title: `Filter by ${String(filter.column)}`,
  }

  return <Slot {...slotProps}>{children}</Slot>
}
