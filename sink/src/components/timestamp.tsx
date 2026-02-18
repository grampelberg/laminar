import { format, formatDistanceToNow } from 'date-fns'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const fullFormatter = new Intl.DateTimeFormat(undefined, {
  timeStyle: 'medium',
})

type TimestampFormat = 'medium' | 'long'

const formatTimestamp = (date: Date, formatType: TimestampFormat) =>
  formatType === 'long'
    ? format(date, "MMM d 'at' HH:mm:ss.SSS")
    : fullFormatter.format(date)

export const Timestamp = ({
  format: formatType = 'medium',
  ms,
  relative = false,
}: {
  format?: TimestampFormat
  ms: number
  relative?: boolean
}) => {
  if (!Number.isFinite(ms)) {
    return <span>-</span>
  }

  const date = new Date(ms)
  const formatted = formatTimestamp(date, formatType)

  if (!relative) {
    return <span>{formatted}</span>
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>{formatDistanceToNow(date)}</span>
      </TooltipTrigger>
      <TooltipContent>{formatted}</TooltipContent>
    </Tooltip>
  )
}
