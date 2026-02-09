import {
  createColumnHelper,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useAtomValue, useAtom } from 'jotai'
import { useRef } from 'react'

import { LevelBadge } from '@/components/level-badge'
import { Timestamp } from '@/components/timestamp'
import { DataTable } from '@/components/ui/data-table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { rowsStateAtom, type RecordRow } from '@/db'
import { selectedAtom } from '@/records.tsx'

import { RecordsInfiniteScroll } from './infinite-scroll'

const columnHelper = createColumnHelper<RecordRow>()

const schema = [
  columnHelper.accessor('ts_ms', {
    cell: ctx => <Timestamp ms={ctx.getValue()} />,
    header: 'Timestamp',
    size: 100,
    enableResizing: false,
  }),
  columnHelper.accessor('level', {
    cell: ctx => <LevelBadge level={ctx.getValue()} />,
    header: 'Level',
    size: 100,
    enableResizing: false,
  }),
  columnHelper.accessor('target', {
    header: 'Source',
    meta: {
      cellClassName: 'truncate font-mono text-xs',
    },
    size: 200,
  }),
  columnHelper.accessor(row => row.message, {
    header: 'Message',
  }),
]

export const RecordsTable = () => {
  const ref = useRef<HTMLDivElement>(null)
  const { rows } = useAtomValue(rowsStateAtom)
  const [selected, setSelected] = useAtom(selectedAtom)

  const table = useReactTable<RecordRow>({
    columns: schema,
    data: rows,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: 'onChange',
    columnResizeDirection: 'ltr',
  })

  return (
    <ScrollArea
      ref={ref}
      className="h-[calc(100vh-8rem)] w-full min-w-0 rounded-md border"
    >
      <RecordsInfiniteScroll rowCount={rows.length} scrollAreaRef={ref} />
      <DataTable
        table={table}
        fullWidth
        bodyRowProps={row => ({
          'data-state':
            selected?.id === row.original.id ? 'selected' : undefined,
          onClick: () => setSelected(row.original),
        })}
      />
    </ScrollArea>
  )
}
