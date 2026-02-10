import { Slot } from '@radix-ui/react-slot'
import { useSetAtom } from 'jotai'
import { isEqual } from 'lodash-es'

import { filtersAtom, type RecordFilter } from '@/db'

export const FilterCell = ({
  children,
  filter,
}: {
  children: React.ReactNode
  filter: RecordFilter
}) => {
  const setFilters = useSetAtom(filtersAtom)

  const addFilter = () => {
    setFilters(current => [...current.filter(i => !isEqual(i, filter)), filter])
  }

  return <Slot onClick={addFilter}>{children}</Slot>
}
