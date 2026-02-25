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
import { useCssVar } from '@/utils'

const TOOLTIP_OFFSET = 8
const INGEST_WINDOW_SECONDS = 120

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

    for (let i = idx; i < points.length; i++) {
      dataRef.current[0].push(points[i].at_ms / millisecondsInSecond)

      dataRef.current[1].push(getRate(points[i - 1], points[i]))
    }

    // This needs to be +1 from the time period so that it doesn't look like the
    // line jerks when the new point is added. The actual view window is being
    // handled by the `setScale` call and not by the number of points in the
    // data.
    const offset = dataRef.current[0].length - INGEST_WINDOW_SECONDS

    if (offset > 0) {
      dataRef.current[0].splice(0, offset)
      dataRef.current[1].splice(0, offset)
    }

    lastRef.current = points.at(-1)?.at_ms ?? Date.now()
  }, [points])

  return dataRef.current
}

const getPos = (u: uPlot) => {
  const {
    cursor: { idx },
  } = u

  if (idx == null || idx < 0) {
    return undefined
  }

  const xValue = u.data[0][idx]
  const yValue = u.data[1][idx]
  if (typeof xValue !== 'number' || typeof yValue !== 'number') {
    return undefined
  }

  return {
    x: u.valToPos(xValue, 'x'),
    y: u.valToPos(yValue, 'y'),
    value: yValue,
  }
}

const Ingest = () => {
  const { points, stats } = useAtomValue(ingestAtom)
  const data = useIngestData(points)

  const totalRows = useAtomValue(totalRowsAtom)
  const ratePerSec = stats.rate ?? 0

  const canvasRef = useRef<HTMLDivElement | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const plotRef = useRef<uPlot | undefined>(undefined)
  const stroke = useCssVar('--color-emerald-500')

  const setTooltip = (u: uPlot) => {
    const tooltip = tooltipRef.current
    if (!tooltip) {
      return
    }

    const pos = getPos(u)
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

    const { width, height } = canvasRef.current.getBoundingClientRect()

    plotRef.current = new uPlot(
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
            paths: uPlot.paths.linear(),
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

    const nowSeconds = Date.now() / millisecondsInSecond
    plotRef.current.setScale('x', {
      min: nowSeconds - INGEST_WINDOW_SECONDS,
      max: nowSeconds,
    })
  })

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
