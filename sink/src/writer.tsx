import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

type StatusDotColor = 'grey' | 'green'

interface ObservedClient {
  id: string
  name: string
  connected: boolean
}

interface StatusProps {
  className?: string
  dotColor?: StatusDotColor
  clients?: ObservedClient[]
}

const dotColorClass: Record<StatusDotColor, string> = {
  green: 'bg-emerald-500',
  grey: 'bg-muted-foreground',
}

const defaultClients: ObservedClient[] = [
  { connected: true, id: 'client-1', name: 'host-a' },
  { connected: false, id: 'client-2', name: 'host-b' },
]

export const Status = ({
  className,
  dotColor = 'grey',
  clients = defaultClients,
}: StatusProps) => {
  const connectedCount = clients.filter(client => client.connected).length

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          className={cn('gap-2 rounded-full', className)}
          size="sm"
          type="button"
          variant="outline"
        >
          Status
          <span
            className={cn('size-1.5 rounded-full', dotColorClass[dotColor])}
            data-slot="status-dot"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72" side="bottom">
        <div className="flex items-center justify-between pb-2">
          <span className="text-sm font-medium">Observed Clients</span>
          <Badge variant="secondary">
            {connectedCount}/{clients.length} connected
          </Badge>
        </div>
        <div className="space-y-2">
          {clients.map(client => (
            <div
              className="flex items-center justify-between rounded-md border px-2 py-1.5"
              key={client.id}
            >
              <span className="text-sm">{client.name}</span>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  className={cn(
                    'size-1.5 rounded-full',
                    client.connected ? 'bg-emerald-500' : 'bg-muted-foreground',
                  )}
                />
                {client.connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
