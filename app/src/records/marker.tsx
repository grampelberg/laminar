import { useSetAtom } from 'jotai'
import {
  CircleAlert,
  CircleCheck,
  CircleX,
  MessageSquarePlus,
  Tag,
  TriangleAlert,
} from 'lucide-react'
import { useState } from 'react'

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { getLogger } from '@/utils'

import { markerAtom, MarkerKind } from './data'

const logger = getLogger(import.meta.url)

export const MARKERS: {
  kind: MarkerKind
  label: string
  icon: typeof CircleAlert
  color: string
}[] = [
  {
    kind: MarkerKind.info,
    label: 'Info',
    icon: CircleAlert,
    color: 'var(--color-sky-600)',
  },
  {
    kind: MarkerKind.warning,
    label: 'Warning',
    icon: TriangleAlert,
    color: 'var(--color-amber-600)',
  },
  {
    kind: MarkerKind.error,
    label: 'Error',
    icon: CircleX,
    color: 'var(--color-red-600)',
  },
  {
    kind: MarkerKind.success,
    label: 'Success',
    icon: CircleCheck,
    color: 'var(--color-emerald-600)',
  },
  {
    kind: MarkerKind.note,
    label: 'Note',
    icon: Tag,
    color: 'var(--color-slate-600)',
  },
]

export const MarkerControl = ({
  rowId,
  markerKind,
}: {
  rowId: number
  markerKind?: MarkerKind
}) => {
  const [open, setOpen] = useState(false)
  const setMarker = useSetAtom(markerAtom)

  const selected = markerKind !== undefined && MARKERS.at(markerKind)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="absolute top-1/2 right-1 z-10 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md bg-card/80 text-muted-foreground opacity-0 backdrop-blur-[1px] transition group-hover:opacity-100 hover:bg-muted hover:text-foreground focus-visible:opacity-100"
          aria-label="Add marker"
          onClick={event => {
            event.stopPropagation()
          }}
        >
          {selected ? (
            <selected.icon
              className={cn('size-4')}
              style={{ color: selected.color }}
            />
          ) : (
            <MessageSquarePlus className="size-4" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="m-2 w-auto p-1" side="top" align="end">
        <div className="space-y-1">
          {MARKERS.map(item => {
            const isSelected = markerKind === item.kind
            const style = { color: item.color }

            return (
              <button
                key={item.kind}
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent data-[state=selected]:bg-muted"
                data-state={isSelected && 'selected'}
                onClick={event => {
                  event.stopPropagation()

                  void setMarker({
                    id: rowId,
                    // eslint-disable-next-line unicorn/no-null
                    kind: isSelected ? null : item.kind,
                  })

                  setOpen(false)
                }}
              >
                <item.icon className="size-3.5" style={style} />
                <span className="flex-1">{item.label}</span>
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
