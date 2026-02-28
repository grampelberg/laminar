import { AnimatePresence, motion } from 'framer-motion'
import { useAtom, useAtomValue } from 'jotai'
import { useCallback } from 'react'

import { Controls } from '@/records/controls.tsx'
import { selectedAtom, identityAtom } from '@/records/data.tsx'
import { RecordDetail } from '@/records/detail.tsx'
import { RecordsTable } from '@/records/table.tsx'

const DETAIL_DURATION = 0.2

const fromRight = {
  offscreen: { x: '100%', opacity: 0 },
  visible: { x: 0, opacity: 1 },
}

export const Records = () => {
  const [selected, setSelected] = useAtom(selectedAtom)
  const identity = useAtomValue(identityAtom)

  const open = selected && identity

  const onDismiss = useCallback(() => {
    setSelected(undefined)
  }, [setSelected])

  return (
    <div className="flex h-[calc(100vh-8rem)] min-w-0 flex-col rounded-md border">
      <Controls />
      <div className="relative flex-1 self-stretch">
        <div className="absolute inset-0 -left-4 flex overflow-hidden">
          <div className="relative ml-4 flex flex-1 self-stretch">
            <motion.div
              className="relative min-h-0 min-w-0 self-stretch"
              animate={{
                width: open ? 'calc(100% / 3 * 2)' : '100%',
              }}
              transition={{
                duration: DETAIL_DURATION,
              }}
            >
              <RecordsTable />
            </motion.div>

            <AnimatePresence>
              {open && (
                <motion.aside
                  className="absolute inset-y-0 right-0 flex min-h-0 w-1/3 min-w-0 border-l"
                  variants={fromRight}
                  initial="offscreen"
                  animate="visible"
                  exit="offscreen"
                  transition={{
                    duration: DETAIL_DURATION,
                  }}
                >
                  <RecordDetail
                    row={selected}
                    identity={identity}
                    onDismiss={onDismiss}
                  />
                </motion.aside>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}
