import { createColumnHelper } from '@tanstack/react-table'
import { type ReactNode } from 'react'

import { levelName, LevelBadge } from '@/components/level-badge'
import { Message } from '@/components/message'
import { Source } from '@/components/source'
import { Timestamp } from '@/components/timestamp'
import {
  type MarkerKind,
  type RecordFilter,
  type RecordRow,
} from '@/records/data'

import { FilterCell } from './filter-cell'
import { MarkerControl } from './marker'

interface RecordsColumnMeta {
  cellClassName?: string
  filterLabel?: (value: unknown) => ReactNode
}

const MessageCell = ({
  rowId,
  text,
  markerKind,
}: {
  rowId: number
  text: string
  markerKind?: MarkerKind
}) => (
  <div className="group relative">
    <Message text={text} variant="table" />
    <MarkerControl rowId={rowId} markerKind={markerKind} />
  </div>
)

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
    cell: ctx => {
      const level = ctx.getValue()
      return (
        <FilterCell filter={{ column: 'level', value: level }}>
          <LevelBadge level={level} />
        </FilterCell>
      )
    },
    header: 'Level',
    meta: {
      filterLabel: value => (
        <span className="uppercase">
          {levelName(value as number | null | undefined)}
        </span>
      ),
    } satisfies RecordsColumnMeta,
    size: 100,
    enableResizing: false,
  }),
  columnHelper.accessor('source', {
    cell: ctx => {
      const source = ctx.getValue()
      return (
        <FilterCell filter={{ column: 'source', value: source }}>
          <Source className="block truncate font-mono text-xs" value={source} />
        </FilterCell>
      )
    },
    header: 'Source',
    meta: {
      cellClassName: 'overflow-hidden',
    } satisfies RecordsColumnMeta,
    size: 200,
  }),
  columnHelper.accessor('message', {
    cell: ctx => (
      <MessageCell
        rowId={ctx.row.original.id}
        text={ctx.getValue()}
        markerKind={(ctx.row.original.marker_kind as MarkerKind) ?? undefined}
      />
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
    .map(col => [String(col.accessorKey), col]),
)

export const filterLabelFor = (filter: RecordFilter): ReactNode => {
  const meta: RecordsColumnMeta = byAccessor.get(filter.column)?.meta ?? {}
  return (meta.filterLabel ?? String)(filter.value)
}
