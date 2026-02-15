import { cva } from 'class-variance-authority'
import { useAtom, useAtomValue } from 'jotai'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

import { byNameAtom, statusUpdateAtom } from './data'

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
        <div className="flex items-center justify-between pb-2">
          <span className="text-sm font-medium">Observed Clients</span>
          <Badge variant="secondary">{totalConnections} connected</Badge>
        </div>
        <div className="space-y-2">
          {allClients.map(client => (
            <div
              className="flex items-center justify-between rounded-md border px-2 py-1.5"
              key={client.name}
            >
              <span className="text-sm">{client.name}</span>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
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
      </PopoverContent>
    </Popover>
  )
}
