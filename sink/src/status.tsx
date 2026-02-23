import { cva } from 'class-variance-authority'
import { formatDistanceToNow } from 'date-fns'
import { millisecondsInSecond } from 'date-fns/constants'
import { filesize } from 'filesize'
import { useAtom, useAtomValue } from 'jotai'
import { VisuallyHidden } from 'radix-ui'
import { type ReactNode, useMemo } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { useLocation, useRoute } from 'wouter'

import { MotionCount } from '@/components/motion-count'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { routes } from '@/routes'
import {
  ingestAtom,
  type SessionRow,
  sessionsAtom,
  statusAtom,
  statusUpdateAtom,
  totalRowsAtom,
} from '@/status/data'

import { getLogger } from './utils'

const logger = getLogger(import.meta.url)

const statusDot = cva('size-1.5 rounded-full', {
  variants: {
    state: {
      connected: 'bg-emerald-500',
      none: 'bg-muted-foreground',
    },
  },
  defaultVariants: {
    state: 'none',
  },
})

const INGEST_CHART_HEIGHT = 28
const INGEST_CHART_STROKE_WIDTH = 1.5

interface IngestChartPoint {
  atMs: number
  rate: number
}

interface IngestTooltipProps {
  active?: boolean
  payload?: { value?: number }[]
}

const IngestChartTooltip = ({
  active,
  payload,
}: IngestTooltipProps): ReactNode => {
  const rate = payload?.[0]?.value
  if (!active || typeof rate !== 'number') {
    return undefined
  }

  return (
    <div className="rounded-md border bg-background px-2 py-1 text-xxs text-muted-foreground shadow-sm">
      {`${rate.toFixed(1)}/sec`}
    </div>
  )
}

const Sessions = ({ rows, total }: { rows: SessionRow[]; total: number }) => (
  <>
    <div className="flex items-center justify-between pb-2 text-xs text-muted-foreground">
      <span>Observed Clients</span>
      <span>{total} connected</span>
    </div>
    <div className="space-y-1">
      {rows.map(client => (
        <div
          className="flex items-center justify-between py-1 text-xs text-muted-foreground"
          key={client.name}
        >
          <span>{client.name}</span>
          <span className="inline-flex flex-col items-end gap-0.5">
            <span className="inline-flex items-center gap-1.5">
              <span
                className={statusDot({
                  state: client.current > 0 ? 'connected' : 'none',
                })}
              />
              {client.current}/{client.total}
            </span>
            {client.current === 0 ? (
              <span className="text-xxs text-muted-foreground/80">
                last seen{' '}
                {formatDistanceToNow(client.last_seen, { addSuffix: true })}
              </span>
            ) : undefined}
          </span>
        </div>
      ))}
    </div>
  </>
)

const Storage = () => {
  const { dbSize } = useAtomValue(statusAtom)

  return (
    <div className="mt-3 border-t pt-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Storage</span>
        <span>{filesize(dbSize)}</span>
      </div>
    </div>
  )
}

const Ingest = () => {
  const { points, stats } = useAtomValue(ingestAtom)
  const totalRows = useAtomValue(totalRowsAtom)
  const ratePerSec = stats.rate ?? 0

  const { data: chartData } = useMemo<IngestChartPoint[]>(() => {
    if (points.length < 2) {
      return []
    }

    return points.reduce(
      (acc, point) => {
        if (!acc.prev) {
          return {
            prev: point,
            data: [0],
          }
        }

        const dtMs = point.at_ms - acc.prev.at_ms
        const delta = point.value - acc.prev.value

        acc.data.push({
          atMs: point.at_ms,
          rate: Math.max(0, (delta / dtMs) * millisecondsInSecond),
        })

        acc.prev = point

        return acc
      },
      { prev: undefined, data: [] },
    )
  }, [points])

  return (
    <div className="mt-3 border-t pt-2">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span>Total</span>
          <MotionCount value={totalRows} />
        </span>
        <span className="inline-flex items-center gap-1">
          <span>Ingest</span>
          <span>
            {ratePerSec <= 0 ? 'idle' : `${ratePerSec.toFixed(1)}/sec`}
          </span>
        </span>
      </div>
      <div className="mt-1 h-7 text-emerald-500/80 dark:text-emerald-400/80">
        <ResponsiveContainer height={INGEST_CHART_HEIGHT} width="100%">
          <LineChart data={chartData}>
            <XAxis
              dataKey="atMs"
              domain={['dataMin', 'dataMax']}
              hide
              type="number"
            />
            <Tooltip content={<IngestChartTooltip />} cursor={false} />
            <Line
              activeDot={false}
              dataKey="rate"
              dot={false}
              isAnimationActive={false}
              stroke="currentColor"
              strokeWidth={INGEST_CHART_STROKE_WIDTH}
              type="linear"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export const Status = () => {
  useAtom(statusUpdateAtom)
  const [isOpen] = useRoute(routes.status)
  const [_location, navigate] = useLocation()

  const { rows: allClients, total: totalSessions } = useAtomValue(sessionsAtom)
  const status = totalSessions > 0 ? 'connected' : 'none'

  return (
    <Sheet
      open={isOpen}
      onOpenChange={open =>
        open ? navigate(routes.status) : globalThis.window.history.back()
      }
    >
      <Button
        className={cn('gap-2')}
        onClick={() => navigate(routes.status)}
        size="sm"
        type="button"
        variant="outline"
      >
        Status
        <span
          className={statusDot({
            state: status,
          })}
          data-slot="status-dot"
        />
      </Button>
      <SheetContent side="right">
        <SheetHeader className="pb-0">
          <SheetTitle>Status</SheetTitle>
          <VisuallyHidden.Root asChild>
            <SheetDescription>
              View current status of the application, such as connected clients
              and local storage usage.
            </SheetDescription>
          </VisuallyHidden.Root>
        </SheetHeader>
        <div className="px-4 pb-4">
          <Sessions rows={allClients} total={totalSessions} />
          <Ingest />
          <Storage />
        </div>
      </SheetContent>
    </Sheet>
  )
}
