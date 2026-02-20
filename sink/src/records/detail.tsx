import { AnimatePresence, motion } from 'framer-motion'
import { useAtom, useAtomValue } from 'jotai'
import type { Selectable } from 'kysely'
import { VisuallyHidden } from 'radix-ui'
import { useEffect, useState, useCallback } from 'react'

import { LevelBadge } from '@/components/level-badge.tsx'
import { Source } from '@/components/source.tsx'
import { Timestamp } from '@/components/timestamp.tsx'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet.tsx'
import type { Identity } from '@/types/db.ts'

import { identityAtom, selectedAtom, type RecordRow } from './data.tsx'
import { DetailTabs } from './detail/tabs.tsx'

export const DetailSheet = ({
  row,
  identity,
  onDismiss,
  open,
}: {
  row: RecordRow
  identity: Selectable<Identity>
  onDismiss: () => void
  open: boolean
}) => (
  <Sheet
    modal={false}
    onOpenChange={open => {
      if (!open) {
        onDismiss()
      }
    }}
    open={open}
  >
    <SheetContent
      className="sm:max-w-3xl lg:max-w-[45vw]"
      onInteractOutside={event => {
        const target = event.target as HTMLElement | null
        // table-row = allow clicking rows to change the detail view.
        // command = don't close when the dev palette opens, this allows taking snapshots.
        if (target?.closest('[data-slot="table-row"], [data-slot="command"]')) {
          event.preventDefault()
        }
      }}
      showOverlay={false}
      side="right"
      onOpenAutoFocus={event => {
        event.preventDefault()
      }}
    >
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <AnimatePresence initial={false}>
          <motion.div className="absolute inset-0 flex min-h-0 flex-col">
            <SheetHeader>
              <SheetTitle>
                <Timestamp format="long" ms={row.ts_ms} />
              </SheetTitle>

              <div className="grid grid-cols-[100px_auto] items-center gap-3 text-sm text-muted-foreground">
                <LevelBadge className="w-15" level={row.level} />
                <Source
                  className="truncate font-mono text-xs"
                  value={row.source}
                />
              </div>

              <VisuallyHidden.Root asChild>
                <SheetDescription>
                  View selected record details.
                </SheetDescription>
              </VisuallyHidden.Root>
            </SheetHeader>
            <DetailTabs row={row} identity={identity} />
          </motion.div>
        </AnimatePresence>
      </div>
    </SheetContent>
  </Sheet>
)

export const RecordDetail = () => {
  const identity = useAtomValue(identityAtom)
  const [row, setSelected] = useAtom(selectedAtom)
  const [detail, setDetail] = useState<
    | {
        identity: Selectable<Identity>
        row: RecordRow
      }
    | undefined
  >(undefined)
  const open = Boolean(row)

  useEffect(() => {
    if (!row || !identity) {
      return
    }

    setDetail({
      identity,
      row,
    })
  }, [identity, row])

  const onDismiss = useCallback(() => {
    setSelected(undefined)
  }, [setSelected])

  return detail && <DetailSheet {...detail} onDismiss={onDismiss} open={open} />
}
