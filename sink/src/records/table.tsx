import {
  getCoreRowModel,
  useReactTable,
  type Row as TRow,
} from '@tanstack/react-table'
import { useAtomValue, useAtom, useSetAtom } from 'jotai'
import { useCallback, useRef } from 'react'

import { DataTable, type Viewport } from '@/components/ui/data-table'
import {
  type RecordRow,
  positionAtom,
  loadMoreRowsAtom,
  refreshRowsAtom,
  rowsStateAtom,
} from '@/db.tsx'
import { cn } from '@/lib/utils'
import { log } from '@/log'
import { selectedAtom } from '@/records.tsx'
import { recordsSchema } from '@/records/schema'

const logger = log(import.meta.url)

const OVERSCAN = 10
const FLASH_DURATION = 5_000

export const RecordsTable = () => {
  const { hasMore, isLoading, pendingNewRows, rows } =
    useAtomValue(rowsStateAtom)
  const [selected, setSelected] = useAtom(selectedAtom)

  const refreshRows = useSetAtom(refreshRowsAtom)
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
      style: active && {
        '--flash-duration': `${FLASH_DURATION}ms`,
        '--flash-delay': `${-elapsed}ms`,
      },
      'data-state': selected?.id === row.original.id ? 'selected' : undefined,
      onClick: () => setSelected(row.original),
    }
  }

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
        refreshRows()
      }

      if (position.bottom && hasMore) {
        loadMoreRows()
      }
    },
    [
      hasMore,
      isLoading,
      loadMoreRows,
      pendingNewRows,
      refreshRows,
      rows.length,
      setPosition,
    ],
  )

  return (
    <DataTable
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
