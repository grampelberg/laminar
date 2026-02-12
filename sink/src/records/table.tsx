import {
  getCoreRowModel,
  useReactTable,
  type Row as TRow,
} from '@tanstack/react-table'
import { useAtomValue, useAtom, useSetAtom } from 'jotai'
import { useCallback, useEffect, useRef, type CSSProperties } from 'react'

import {
  DataTable,
  type DataTableHandle,
  type Viewport,
} from '@/components/ui/data-table'
import {
  type RecordRow,
  filtersAtom,
  positionAtom,
  loadMoreRowsAtom,
  newRowsAtom,
  rowsStateAtom,
} from '@/db.tsx'
import { cn } from '@/lib/utils'
import { log } from '@/log'
import { selectedAtom } from '@/records.tsx'
import { recordsSchema } from '@/records/schema'

const logger = log(import.meta.url)

const OVERSCAN = 10
const FLASH_DURATION = 5000

export const RecordsTable = () => {
  const filters = useAtomValue(filtersAtom)
  const { hasMore, isLoading, pendingNewRows, rows } =
    useAtomValue(rowsStateAtom)
  const [selected, setSelected] = useAtom(selectedAtom)
  const dataTableRef = useRef<DataTableHandle>(null)

  const newRows = useSetAtom(newRowsAtom)
  const loadMoreRows = useSetAtom(loadMoreRowsAtom)
  const setPosition = useSetAtom(positionAtom)

  const table = useReactTable<RecordRow>({
    columns: recordsSchema,
    data: rows,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: 'onChange',
    columnResizeDirection: 'ltr',
    getRowId: row => String(row.id),
  })

  useEffect(() => {
    dataTableRef.current?.scrollToTop()
  }, [filters])

  const onScroll = useCallback(
    ({ first, last }: Viewport) => {
      if (isLoading || rows.length === 0) {
        return
      }

      const position = {
        top: first - OVERSCAN <= 0,
        bottom: last + OVERSCAN >= rows.length,
      }

      setPosition(position)

      if (position.top && pendingNewRows) {
        newRows()
      }

      if (position.bottom && hasMore) {
        loadMoreRows()
      }
    },
    [
      hasMore,
      isLoading,
      loadMoreRows,
      newRows,
      pendingNewRows,
      rows.length,
      setPosition,
    ],
  )

  const rowProps = (row: TRow<RecordRow>) => {
    let active = false

    let elapsed = 0
    if (row.original._added) {
      elapsed = Date.now() - row.original._added
      active = FLASH_DURATION - elapsed > 0
    }

    return {
      className: cn(
        '[&>td>*]:animate-fade-in',
        active && 'flash-border-left flash-row',
      ),
      style: active
        ? ({
            '--flash-duration': `${FLASH_DURATION}ms`,
            '--flash-delay': `${-elapsed}ms`,
          } as CSSProperties)
        : undefined,
      'data-state': selected?.id === row.original.id ? 'selected' : undefined,
      onClick: () => setSelected(row.original),
    }
  }

  return (
    <DataTable
      ref={dataTableRef}
      table={table}
      fullWidth
      useRowProps={rowProps}
      virtualOpts={{
        overscan: OVERSCAN,
      }}
      onScroll={onScroll}
    />
  )
}
