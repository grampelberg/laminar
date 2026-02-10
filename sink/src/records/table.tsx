import {
  getCoreRowModel,
  useReactTable,
  type Row as TRow,
} from '@tanstack/react-table'
import { useAtomValue, useAtom, useSetAtom } from 'jotai'
import { useCallback } from 'react'

import { DataTable, type Viewport } from '@/components/ui/data-table'
import {
  type RecordRow,
  positionAtom,
  loadMoreRowsAtom,
  refreshRowsAtom,
  rowsStateAtom,
} from '@/db.tsx'
import { log } from '@/log'
import { selectedAtom } from '@/records.tsx'
import { recordsSchema } from '@/records/schema'

const logger = log(import.meta.url)

const OVERSCAN = 10

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
  })

  const rowSelected = (row: TRow<RecordRow>) => ({
    'data-state': selected?.id === row.original.id ? 'selected' : undefined,
    onClick: () => setSelected(row.original),
  })

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
      rowProps={rowSelected}
      virtualOpts={{
        overscan: OVERSCAN,
      }}
      onScroll={onScroll}
    />
  )
}
