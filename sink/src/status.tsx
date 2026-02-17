import { cva } from 'class-variance-authority'
import { formatDistanceToNow } from 'date-fns'
import { filesize } from 'filesize'
import { useAtom, useAtomValue } from 'jotai'
import { VisuallyHidden } from 'radix-ui'
import { useLocation, useRoute } from 'wouter'

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
  type SessionRow,
  sessionsAtom,
  statusAtom,
  statusUpdateAtom,
} from '@/status/data'

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
          <Storage />
        </div>
      </SheetContent>
    </Sheet>
  )
}
