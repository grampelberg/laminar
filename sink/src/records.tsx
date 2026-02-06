import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useEffect, useRef } from 'react'

import type { RecordRow } from '@/db.tsx'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './components/ui/table.tsx'
import {
  isNearTopAtom,
  loadMoreRowsAtom,
  pendingNewRowsAtom,
  refreshRowsAtom,
  rowsStateAtom,
} from './db.tsx'

interface ColumnMeta {
  headClassName?: string
  cellClassName?: string
}

const columnHelper = createColumnHelper<RecordRow>()
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'medium',
})
const levelLabelMap: Record<number, string> = {
  0: 'TRACE',
  1: 'DEBUG',
  2: 'INFO',
  3: 'WARN',
  4: 'ERROR',
  5: 'OFF',
}

const formatLevel = (value: unknown): string => {
  const level = typeof value === 'number' ? value : Number(value)
  return levelLabelMap[level] ?? String(value)
}

const levelClassMap: Record<number, string> = {
  0: 'text-muted-foreground',
  1: 'text-blue-600',
  2: 'text-emerald-600',
  3: 'text-amber-600',
  4: 'text-red-600',
  5: 'text-zinc-500',
}

const getLevelClassName = (value: unknown): string => {
  const level = typeof value === 'number' ? value : Number(value)
  return levelClassMap[level] ?? 'text-foreground'
}
const NEAR_TOP_THRESHOLD_PX = 32
const NEAR_BOTTOM_THRESHOLD_PX = 64

export const columnDefinition = [
  columnHelper.accessor('ts_ms', {
    header: 'Timestamp',
    cell: info => {
      const ms = info.getValue()
      if (!Number.isFinite(ms)) {
        return '-'
      }
      return dateTimeFormatter.format(new Date(ms))
    },
    meta: {
      headClassName: 'w-1 whitespace-nowrap',
      cellClassName: 'whitespace-nowrap',
    },
  }),
  columnHelper.accessor('level', {
    header: 'Level',
    cell: info => (
      <span className={getLevelClassName(info.getValue())}>
        {formatLevel(info.getValue())}
      </span>
    ),
    meta: {
      headClassName: 'w-1 whitespace-nowrap',
      cellClassName: 'whitespace-nowrap',
    },
  }),
  columnHelper.accessor('target', {
    header: 'Source',
    meta: {
      headClassName: 'w-32',
      cellClassName: 'w-32 truncate',
    },
  }),
  // TODO:
  // - This is going to be multi-line and should maybe to in a <pre>?
  columnHelper.accessor(row => row.message, {
    id: 'message',
    header: 'Message',
  }),
]

export const RecordsTable = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const { rows, hasMore, isLoading } = useAtomValue(rowsStateAtom)
  const [isNearTop, setIsNearTop] = useAtom(isNearTopAtom)
  const pendingNewRows = useAtomValue(pendingNewRowsAtom)
  const refreshRows = useSetAtom(refreshRowsAtom)
  const loadMoreRows = useSetAtom(loadMoreRowsAtom)

  const table = useReactTable<RecordRow>({
    data: rows,
    columns: columnDefinition,
    getCoreRowModel: getCoreRowModel(),
  })

  useEffect(() => {
    const element = containerRef.current
    if (!element) {
      return
    }
    setIsNearTop(element.scrollTop <= NEAR_TOP_THRESHOLD_PX)
  }, [setIsNearTop])

  useEffect(() => {
    if (!isNearTop || pendingNewRows === 0) {
      return
    }

    void refreshRows()
  }, [isNearTop, pendingNewRows, refreshRows])

  const handleScroll = (element: HTMLDivElement) => {
    setIsNearTop(element.scrollTop <= NEAR_TOP_THRESHOLD_PX)

    const distanceFromBottom =
      element.scrollHeight - (element.scrollTop + element.clientHeight)

    if (
      distanceFromBottom <= NEAR_BOTTOM_THRESHOLD_PX &&
      hasMore &&
      !isLoading
    ) {
      void loadMoreRows()
    }
  }

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-auto rounded-md border"
      onScroll={event => {
        handleScroll(event.currentTarget)
      }}
    >
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map(headerGroup => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <TableHead
                  key={header.id}
                  className={
                    (header.column.columnDef.meta as ColumnMeta | undefined)
                      ?.headClassName
                  }
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map(row => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && 'selected'}
              >
                {row.getVisibleCells().map(cell => (
                  <TableCell
                    key={cell.id}
                    className={
                      (cell.column.columnDef.meta as ColumnMeta | undefined)
                        ?.cellClassName
                    }
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={columnDefinition.length}
                className="h-24 text-center"
              >
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
