import {
  getCoreRowModel,
  useReactTable,
  type Row as TRow,
} from '@tanstack/react-table'
import { type Virtualizer, useVirtualizer } from '@tanstack/react-virtual'
import { useAtomValue, useAtom, useSetAtom } from 'jotai'
import { useEffect, useRef, type CSSProperties } from 'react'

import { DataTable } from '@/components/ui/data-table'
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
const DEFAULT_ROW_HEIGHT = 40

export const __test = {
  OVERSCAN,
}

const getPosition = (virtual: Virtualizer<HTMLDivElement, Element>) => {
  const items = virtual.getVirtualItems()
  const first = items[0]?.index ?? 0
  const last = items.at(-1)?.index ?? 0

  return {
    top: (virtual.scrollOffset || 0) - virtual.options.estimateSize(first) <= 0,
    bottom: last >= virtual.options.count - virtual.options.overscan - 1,
  }
}

export const RecordsTable = () => {
  const { rows, loaded } = useAtomValue(stateAtom)
  const filters = useAtomValue(filtersAtom)
  const [selected, setSelected] = useAtom(selectedAtom)
  const viewportRef = useRef<HTMLDivElement>(null)

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

  const virtual = useVirtualizer({
    count: rows.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: () => DEFAULT_ROW_HEIGHT,
    overscan: OVERSCAN,
  })

  useEffect(() => {
    viewportRef.current?.scrollTo({ top: 0 })
  }, [filters])

  const position = getPosition(virtual)

  useEffect(() => {
    setPosition(position)
  }, [position.top, position.bottom])

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
      style: {
        ...(active &&
          ({
            '--flash-duration': `${FLASH_DURATION}ms`,
            '--flash-delay': `${-elapsed}ms`,
          } as CSSProperties)),
      },
      'data-state': selected?.id === row.original.id ? 'selected' : undefined,
      onClick: () => setSelected(row.original),
    }
  }

  return (
    <div
      ref={viewportRef}
      role="region"
      aria-label="Records viewport"
      data-slot="scroll-area-viewport"
      className="absolute inset-0 -left-4 overflow-scroll"
    >
      <div className="ml-4">
        <div className="sticky top-0 z-50 h-0 -translate-x-4">
          <div className="h-10 w-4 bg-background" />
        </div>
        <DataTable
          table={table}
          fullWidth
          loading={!loaded}
          loadingRowCount={12}
          getRowProps={rowProps}
          virtual={virtual}
        />
      </div>
    </div>
  )
}
