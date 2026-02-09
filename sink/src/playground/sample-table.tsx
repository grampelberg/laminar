import {
  createColumnHelper,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'

import { DataTable } from '@/components/ui/data-table'
import { ScrollArea } from '@/components/ui/scroll-area'

import data from './data.json'

interface SampleRow {
  message: string
  target: string
  name: string
}

const builder = createColumnHelper<SampleRow>()

const schema = [
  builder.accessor('target', {}),
  builder.accessor('name', {}),
  builder.accessor('message', {}),
]

export const SampleTable = () => {
  const table = useReactTable<SampleRow>({
    columns: schema,
    data: data,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: 'onChange',
    columnResizeDirection: 'ltr',
  })

  return (
    <div className="container mx-auto py-8">
      <ScrollArea className="h-[calc(100vh-8rem)] w-full min-w-0 rounded-md border">
        <DataTable table={table} fullWidth />
      </ScrollArea>
    </div>
  )
}
