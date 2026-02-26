import { cva, type VariantProps } from 'class-variance-authority'

import { AnsiText } from '@/components/ansi-text.tsx'
import { cn } from '@/lib/utils'

const messageVariants = cva('text-sm', {
  variants: {
    variant: {
      detail: 'wrap-break-word whitespace-pre-wrap',
      table: 'block w-full truncate whitespace-nowrap',
    },
  },
  defaultVariants: {
    variant: 'detail',
  },
})

export const Message = ({
  className,
  text,
  variant,
}: {
  className?: string
  text: string
} & VariantProps<typeof messageVariants>) => (
  <AnsiText
    className={cn(messageVariants({ variant }), className)}
    text={text}
  />
)
