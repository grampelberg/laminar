import { cva } from 'class-variance-authority'

import { Badge } from '@/components/ui/badge'

const levels = ['trace', 'debug', 'info', 'warn', 'error', 'off'] as const

const levelBadgeVariants = cva(
  ['uppercase', 'text-xxs', 'font-semibold', 'tracking-wider', 'w-full'],
  {
    variants: {
      level: {
        debug: [
          'bg-fill-level-debug',
          'border-stroke-level-debug',
          'text-text-level-debug',
        ],
        error: [
          'bg-fill-level-error',
          'border-stroke-level-error',
          'text-text-level-error',
        ],
        info: [
          'bg-fill-level-info',
          'border-stroke-level-info',
          'text-text-level-info',
        ],
        off: [
          'bg-fill-level-off',
          'border-stroke-level-off',
          'text-text-level-off',
        ],
        trace: [
          'bg-fill-level-trace',
          'border-stroke-level-trace',
          'text-text-level-trace',
        ],
        warn: [
          'bg-fill-level-warn',
          'border-stroke-level-warn',
          'text-text-level-warn',
        ],
      },
    },
  },
)

export const LevelBadge = ({ level }: { level: number }) => {
  const name = levels[level]
  return <Badge className={levelBadgeVariants({ level: name })}>{name}</Badge>
}
