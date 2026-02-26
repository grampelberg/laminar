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
import { cn } from '@/lib/utils'
import { recordsSchema } from '@/records/schema'
import { getLogger } from '@/utils'

import { selectedAtom } from './data.tsx'
import { filtersAtom } from './data/filter.ts'
import {
  type RecordRow,
  stateAtom,
  positionAtom,
  loadMoreAtom,
  streamUpdateAtom,
} from './data/rows.ts'

const logger = getLogger(import.meta.url)

const OVERSCAN = 10
const FLASH_DURATION = 5000

export const __test = {
  OVERSCAN,
}

export const RecordsTable = () => {
  const { rows, loaded } = useAtomValue(stateAtom)
  const filters = useAtomValue(filtersAtom)
  const [selected, setSelected] = useAtom(selectedAtom)
  const dataTableRef = useRef<DataTableHandle>(null)

  useAtom(loadMoreAtom)
  useAtom(streamUpdateAtom)

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
    (position: Viewport) => {
      setPosition(position)
    },
    [rows.length, setPosition],
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
      loading={!loaded}
      loadingRowCount={12}
      getRowProps={rowProps}
      virtualOpts={{
        overscan: OVERSCAN,
      }}
      onScroll={onScroll}
    />
  )
}
