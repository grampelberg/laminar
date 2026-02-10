import {
  createColumnHelper,
  getCoreRowModel,
  useReactTable,
  type Row as TRow,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useAtomValue, useAtom, useSetAtom } from 'jotai'
import { range } from 'lodash-es'
import { ScrollArea as ScrollAreaPrimitive } from 'radix-ui'
import { useRef, useCallback } from 'react'

import { LevelBadge } from '@/components/level-badge'
import { Timestamp } from '@/components/timestamp'
import { DataTable, Viewport } from '@/components/ui/data-table'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  type RecordRow,
  positionAtom,
  loadMoreRowsAtom,
  refreshRowsAtom,
  rowsStateAtom,
} from '@/db.tsx'
import { cn, memo } from '@/lib/utils'
import { log } from '@/log'
import { selectedAtom } from '@/records.tsx'

import { FilterCell } from './filter-cell'
import { RecordsInfiniteScroll } from './infinite-scroll'

const logger = log(import.meta.url)

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
    // cell: ctx => (
    //   <FilterCell filter={{ column: 'level', value: ctx.getValue() }}>
    //     <LevelBadge level={ctx.getValue()} />
    //   </FilterCell>
    // ),
    header: 'Level',
    size: 100,
    enableResizing: false,
  }),
  columnHelper.accessor('target', {
    // cell: ctx => <div>{ctx.getValue()}</div>,
    // cell: ctx => (
    //   <FilterCell filter={{ column: 'target', value: ctx.getValue() }}>
    //     <div>{ctx.getValue()}</div>
    //   </FilterCell>
    // ),
    header: 'Source',
    meta: {
      cellClassName: 'truncate font-mono text-xs',
    },
    size: 200,
  }),
  columnHelper.accessor('message', {
    header: 'Message',
    meta: {
      cellClassName: 'truncate',
    },
  }),
]

const OVERSCAN = 10

export const RecordsTable = () => {
  const { hasMore, isLoading, pendingNewRows, rows } =
    useAtomValue(rowsStateAtom)
  const [selected, setSelected] = useAtom(selectedAtom)

  const refreshRows = useSetAtom(refreshRowsAtom)
  const loadMoreRows = useSetAtom(loadMoreRowsAtom)
  const setPosition = useSetAtom(positionAtom)

  const table = useReactTable<RecordRow>({
    columns: schema,
    data: rows,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: 'onChange',
    columnResizeDirection: 'ltr',
  })

  const rowSelected = (row: TRow<RecordRow>) => ({
    'data-state': selected?.id === row.original.id ? 'selected' : undefined,
    onClick: () => setSelected(row.original),
  })

  const onScroll = useCallback(({ first, last }: Viewport) => {
    if (isLoading || rows.length === 0) {
      return
    }

    const position = {
      top: first - OVERSCAN <= 0,
      bottom: last + OVERSCAN >= rows.length,
    }

    setPosition(position)

    if (position.top && pendingNewRows) {
      refreshRows()
    }

    if (position.bottom && hasMore) {
      loadMoreRows()
    }
  }, [isLoading, setPosition, refreshRows, loadMoreRows, rows.length])

  return (
    <DataTable
      table={table}
      fullWidth
      rowProps={rowSelected}
      virtualOpts={{
        overscan: OVERSCAN,
      }}
      onScroll={onScroll}
    />
  )
}
