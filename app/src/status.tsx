import 'uplot/dist/uPlot.min.css'

import { cva } from 'class-variance-authority'
import { formatDistanceToNow } from 'date-fns'
import { millisecondsInSecond } from 'date-fns/constants'
import { filesize } from 'filesize'
import { useAnimationFrame } from 'framer-motion'
import { useAtom, useAtomValue } from 'jotai'
import { VisuallyHidden } from 'radix-ui'
import { useEffect, useRef } from 'react'
import uPlot from 'uplot'
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
  type IngestPoint,
  type SessionRow,
  sessionsAtom,
  statusAtom,
  statusUpdateAtom,
  totalRowsAtom,
} from '@/status/data'
import { useCssVar, getLogger } from '@/utils'

const logger = getLogger(import.meta.url)

const TOOLTIP_OFFSET = 8
const INGEST_WINDOW_SECONDS = 120
const PADDING = 4
const PADDED_WINDOW = INGEST_WINDOW_SECONDS + PADDING
const UPlot = uPlot

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

type UPlotData = [number[], number[]]

const getRate = (prev: IngestPoint, next: IngestPoint) => {
  const dtMs = next.at_ms - prev.at_ms
  const delta = next.value - prev.value

  return Math.max(0, (delta / dtMs) * millisecondsInSecond)
}

const intoData = (data: UPlotData, points: IngestPoint[], start: number) => {
  for (let i = start === -1 ? 1 : start; i < points.length; i++) {
    data[0].push(points[i].at_ms / millisecondsInSecond)

    data[1].push(getRate(points[i - 1], points[i]))
  }

  while (data[0].length < PADDED_WINDOW) {
    data[0].unshift(data[0][0] - 1)
    data[1].unshift(data[1][0])
  }
}

export const useIngestData = (points: IngestPoint[]): UPlotData => {
  const dataRef = useRef<UPlotData>([[], []])
  const lastRef = useRef(Date.now())

  useEffect(() => {
    if (points.length < 2) {
      return
    }

    let idx = points.findLastIndex(point => point.at_ms > lastRef.current)
    if (idx === -1) {
      idx = 1
    }

    intoData(dataRef.current, points, idx)

    // This needs to be a little longer than the WINDOW. On the left, this
    // ensures that there's always data drawn as the line moves out of the
    // viewport. On the right, this ensures that there's always data drawn as
    // the lien moves *into* the viewport. In both cases, having some extra
    // points means that the line already exists to animate right to left
    // instead of drawing (or removing) points in the viewport causing the plot
    // to look jerky.
    const offset = dataRef.current[0].length - PADDED_WINDOW

    if (offset > 0) {
      dataRef.current[0].splice(0, offset)
      dataRef.current[1].splice(0, offset)
    }

    lastRef.current = points.at(-1)?.at_ms ?? Date.now()
  }, [points])

  return dataRef.current
}

const getPos = (plot: uPlot) => {
  const {
    cursor: { idx },
  } = plot

  if (typeof idx !== 'number' || idx < 0) {
    return undefined
  }

  const xValue = plot.data[0][idx]
  const yValue = plot.data[1][idx]
  if (typeof xValue !== 'number' || typeof yValue !== 'number') {
    return undefined
  }

  return {
    x: plot.valToPos(xValue, 'x'),
    y: plot.valToPos(yValue, 'y'),
    value: yValue,
  }
}

const Ingest = () => {
  const total = useAtomValue(totalRowsAtom)

  const { points, stats } = useAtomValue(ingestAtom)
  const data = useIngestData(points)

  const ratePerSec = stats.rate ?? 0

  const canvasRef = useRef<HTMLDivElement | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const plotRef = useRef<uPlot | undefined>(undefined)
  const stroke = useCssVar('--color-emerald-500')

  const setTooltip = (plot: uPlot) => {
    const tooltip = tooltipRef.current
    if (!tooltip) {
      return
    }

    const pos = getPos(plot)
    if (!pos) {
      tooltip.style.opacity = '0'
      return
    }

    const { x, y, value } = pos

    tooltip.style.opacity = '1'
    tooltip.style.transform = `translate(${x + TOOLTIP_OFFSET}px, ${y - TOOLTIP_OFFSET}px)`
    tooltip.textContent = `${value.toFixed(1)}/sec`
  }

  useEffect(() => {
    if (!canvasRef.current) {
      return
    }

    const linearPaths = uPlot.paths?.linear?.()
    const { width, height } = canvasRef.current.getBoundingClientRect()

    plotRef.current = new UPlot(
      {
        width,
        height,
        legend: { show: false },
        cursor: { y: false },
        series: [
          {},
          {
            stroke,
            width: 2,
            ...(linearPaths ? { paths: linearPaths } : {}),
            spanGaps: true,
            pxAlign: 0,
            points: { show: false },
          },
        ],
        axes: [{ show: false }, { show: false }],
        scales: {
          x: { time: false },
        },
        hooks: {
          ready: [setTooltip],
          setCursor: [setTooltip],
          setData: [setTooltip],
        },
      },
      data,
      canvasRef.current,
    )

    return () => {
      plotRef.current?.destroy()
      plotRef.current = undefined
    }
  }, [stroke])

  useAnimationFrame(() => {
    if (!plotRef.current) {
      return
    }

    plotRef.current.setData(data, false)

    // This adjusts so that the plot doesn't move if there's no more data. While
    // this is unlikely in normal operation, it'll happen if there's a fixture
    // applied.
    const now = Date.now() / millisecondsInSecond
    const last = data[0].at(-1) || 0
    const idle = 2
    // Go back a step so that the point can be drawn immediately. This gets rid
    // of what looks like a little jerkiness when there's a gap between moving
    // left and having a new point inserted for the most recent data.
    const max = now - last <= idle ? now - 2 : last

    plotRef.current.setScale('x', {
      min: max - INGEST_WINDOW_SECONDS,
      max,
    })
  })

  return (
    <div className="mt-3 border-t pt-2">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span>Total</span>
          <MotionCount value={total} />
        </span>
        <span className="inline-flex items-center gap-1">
          <span>Ingest</span>
          <span>
            {ratePerSec <= 0 ? 'idle' : `${ratePerSec.toFixed(1)}/sec`}
          </span>
        </span>
      </div>
      <div className="relative mt-2 h-7 w-full">
        <div ref={canvasRef} className="h-7 w-full" />
        <div
          className="pointer-events-none absolute top-0 left-0 z-10 rounded border bg-background px-1.5 py-0.5 text-xxs text-muted-foreground opacity-0 shadow-sm transition-opacity"
          ref={tooltipRef}
        />
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
