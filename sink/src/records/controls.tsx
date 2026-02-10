import { Filters } from '@/records/filters'
import { RowCount } from '@/records/row-count'

export const Controls = () => (
  <div className="border-b px-4 py-2 text-sm">
    <div className="flex items-center justify-between gap-4 text-muted-foreground">
      <Filters />
      <RowCount />
    </div>
  </div>
)
