import { cva } from 'class-variance-authority'
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
  type ByNameRow,
  byNameAtom,
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

const Connections = ({
  rows,
  totalConnected,
}: {
  rows: ByNameRow[]
  totalConnected: number
}) => (
  <>
    <div className="flex items-center justify-between pb-2 text-xs text-muted-foreground">
      <span>Observed Clients</span>
      <span>{totalConnected} connected</span>
    </div>
    <div className="space-y-1">
      {rows.map(client => (
        <div
          className="flex items-center justify-between py-1 text-xs text-muted-foreground"
          key={client.name}
        >
          <span>{client.name}</span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className={statusDot({
                state: client.current_connections > 0 ? 'connected' : 'none',
              })}
            />
            {client.current_connections}/{client.total_clients}
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

  const { rows: allClients, totalConnected: totalConnections } =
    useAtomValue(byNameAtom)
  const status = totalConnections > 0 ? 'connected' : 'none'

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
        <Connections rows={allClients} totalConnected={totalConnections} />
        <Storage />
      </PopoverContent>
    </Popover>
  )
}
