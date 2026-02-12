import { createColumnHelper } from '@tanstack/react-table'
import type { ReactNode } from 'react'

import { levelName, LevelBadge } from '@/components/level-badge'
import { Timestamp } from '@/components/timestamp'
import type { RecordFilter, RecordRow } from '@/db'

import { FilterCell } from './filter-cell'

interface RecordsColumnMeta {
  cellClassName?: string
  filterLabel?: (value: unknown) => ReactNode
}

const columnHelper = createColumnHelper<RecordRow>()

// Note: make sure all columns are in *some* kind of element. Without an element
// it won't animate. This is because the fade-in animation runs on the direct
// children of the <td> cells themselves. That animation is targetted there so
// that the flash animation (which must be via a pseudo element inserted into
// the first <td>) doesn't have a fade-in animation while it is doing the
// fade-out. The first <td> requirement is because browsers are not great at
// animating box-shadow and in particular, WebKit really dislikes animating
// anything at the row level.
export const recordsSchema = [
  columnHelper.accessor('ts_ms', {
    cell: ctx => <Timestamp ms={ctx.getValue()} />,
    header: 'Timestamp',
    size: 100,
    enableResizing: false,
  }),
  columnHelper.accessor('level', {
    cell: ctx => (
      <FilterCell filter={{ column: 'level', value: ctx.getValue() }}>
        <LevelBadge level={ctx.getValue()} />
      </FilterCell>
    ),
    header: 'Level',
    meta: {
      filterLabel: value =>
        typeof value === 'number' ? (
          <span className="uppercase">{levelName(value)}</span>
        ) : (
          String(value)
        ),
    } satisfies RecordsColumnMeta,
    size: 100,
    enableResizing: false,
  }),
  columnHelper.accessor('target', {
    cell: ctx => (
      <FilterCell filter={{ column: 'target', value: ctx.getValue() }}>
        <div>{ctx.getValue()}</div>
      </FilterCell>
    ),
    header: 'Source',
    meta: {
      cellClassName: 'truncate font-mono text-xs',
    } satisfies RecordsColumnMeta,
    size: 200,
  }),
  columnHelper.accessor('message', {
    cell: ctx => (
      <span className="block w-full truncate">{ctx.getValue()}</span>
    ),
    header: 'Message',
    meta: {
      cellClassName: 'overflow-hidden',
    } satisfies RecordsColumnMeta,
  }),
]

const byAccessor = new Map<string, (typeof recordsSchema)[number]>(
  recordsSchema
    .filter(col => 'accessorKey' in col && typeof col.accessorKey === 'string')
    .map(col => [col.accessorKey, col]),
)

export const filterLabelFor = (filter: RecordFilter): ReactNode => {
  const meta: RecordsColumnMeta = byAccessor.get(filter.column)?.meta ?? {}
  return (meta.filterLabel ?? String)(filter.value)
}
