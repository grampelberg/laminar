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
    header: 'Message',
    meta: {
      cellClassName: 'truncate',
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
