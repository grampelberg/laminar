import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

export const Source = ({
  className,
  value,
  ...props
}: {
  value?: string | null
} & ComponentProps<'span'>) => {
  if (typeof value !== 'string' || value.length === 0) {
    return (
      <span
        className={cn('text-muted-foreground', className)}
        {...props}
      >
        -
      </span>
    )
  }

  return (
    <span className={cn(className)} {...props}>
      {value}
    </span>
  )
}
