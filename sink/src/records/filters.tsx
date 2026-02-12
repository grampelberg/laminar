import { useAtom } from 'jotai'
import { X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { filtersAtom } from '@/db'
import { filterLabelFor } from '@/records/schema'

export const Filters = () => {
  const [filters, setFilters] = useAtom(filtersAtom)

  const removeFilter = (index: number) => {
    setFilters(current => current.filter((_, itemIndex) => itemIndex !== index))
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {filters.map((filter, index) => (
        <Badge
          key={`${String(filter.column)}:${String(filter.value)}:${index}`}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs"
          variant="secondary"
        >
          <span className="max-w-40 truncate">{filterLabelFor(filter)}</span>
          <button
            className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => removeFilter(index)}
            type="button"
          >
            <X className="size-3" />
          </button>
        </Badge>
      ))}
    </div>
  )
}
