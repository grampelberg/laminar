import { formatDistanceToNow } from 'date-fns'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const fullFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'medium',
})

export const Timestamp = ({
  ms,
  relative = false,
}: {
  ms: number
  relative?: boolean
}) => {
  if (!Number.isFinite(ms)) {
    return <span>-</span>
  }

  const date = new Date(ms)

  if (!relative) {
    return <span>{fullFormatter.format(date)}</span>
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>{formatDistanceToNow(date)}</span>
      </TooltipTrigger>
      <TooltipContent>{fullFormatter.format(date)}</TooltipContent>
    </Tooltip>
  )
}
