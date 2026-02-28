import { createColumnHelper } from '@tanstack/react-table'
import { AnimatePresence, motion } from 'framer-motion'
import { type ReactNode } from 'react'

import { levelName, LevelBadge } from '@/components/level-badge'
import { Message } from '@/components/message'
import { Source } from '@/components/source'
import { Timestamp } from '@/components/timestamp'
import { cn } from '@/lib/utils'
import {
  type MarkerKind,
  type RecordFilter,
  type RecordRow,
} from '@/records/data'
import { getLogger } from '@/utils'

import { FilterCell } from './filter-cell'
import { MARKERS, MarkerControl } from './marker'

const logger = getLogger(import.meta.url)

interface RecordsColumnMeta {
  cellClassName?: string
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

const TimestampCell = ({ row }: { row: RecordRow }) => {
  const kind = row.marker_kind

  const selected = kind !== null && MARKERS.at(kind)

  return (
    <AnimatePresence>
      {selected && (
        <>
          <motion.div
            key="marker-border"
            className="pointer-events-none absolute inset-y-0 left-0 w-1.25"
            style={{ backgroundColor: selected.color }}
            {...markerAnimation}
          />
          <FilterCell
            key="marker-icon"
            filter={{ column: 'marker_kind', value: kind }}
          >
            <motion.div
              key="marker-icon"
              {...markerAnimation}
              className={cn(
                'absolute',
                'top-1/2',
                'left-0',
                'z-20',
                '-translate-x-1/2',
                '-translate-y-1/2',
                'cursor-pointer',
                'rounded-full',
                'bg-card/90',
                'shadow-xs',
                'backdrop-blur-[1px]',
              )}
            >
              <selected.icon
                className="size-5"
                style={{ color: selected.color }}
              />
            </motion.div>
          </FilterCell>
        </>
      )}
      <Timestamp ms={row.ts_ms} key="timestamp" />
    </AnimatePresence>
  )
}

const columnHelper = createColumnHelper<RecordRow>()

const markerAnimation = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2 },
}

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
    cell: ctx => <TimestampCell row={ctx.row.original} />,
    meta: {
      cellClassName: 'relative',
    },
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
    },
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

const filterLabels = {
  level: (value: unknown) => (
    <span className="uppercase">
      {levelName(value as number | null | undefined)}
    </span>
  ),
  marker_kind: (value: unknown) => {
    const marker =
      typeof value === 'number'
        ? MARKERS.at(value)
        : undefined
    return <span>{marker?.label ?? String(value)}</span>
  },
} satisfies Partial<Record<RecordFilter['column'], (value: unknown) => ReactNode>>

export const filterLabelFor = (filter: RecordFilter): ReactNode =>
  (
    filterLabels[filter.column as keyof typeof filterLabels] ?? String
  )(filter.value)
