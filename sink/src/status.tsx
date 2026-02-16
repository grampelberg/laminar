import { cva } from 'class-variance-authority'
import { formatDistanceToNow } from 'date-fns'
import { filesize } from 'filesize'
import { useAtom, useAtomValue } from 'jotai'

import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
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

  const { rows: allClients, total: totalSessions } = useAtomValue(sessionsAtom)
  const status = totalSessions > 0 ? 'connected' : 'none'

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          className={cn('gap-2 rounded-full')}
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
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72" side="bottom">
        <Sessions rows={allClients} total={totalSessions} />
        <Storage />
      </PopoverContent>
    </Popover>
  )
}
