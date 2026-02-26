import { AnimatePresence, motion } from 'framer-motion'
import { useAtomValue } from 'jotai'
import { Check, Copy } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button.tsx'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover.tsx'
import { stateAtom } from '@/state.ts'
import { getLogger } from '@/utils.ts'

const logger = getLogger(import.meta.url)

const CLOSE_POPOVER = 1000
const PULSE_DURATION = 0.35
const PULSE_SCALE = 1.08
const ICON_SWAP = 0.15

export const AddressButton = () => {
  const state = useAtomValue(stateAtom)
  const [copiedOpen, setCopiedOpen] = useState(false)
  const [pulseKey, setPulseKey] = useState(0)
  const copiedTimer = useRef<ReturnType<typeof globalThis.setTimeout> | null>(
    null,
  )

  useEffect(
    () => () => {
      if (copiedTimer.current) {
        globalThis.clearTimeout(copiedTimer.current)
      }
    },
    [],
  )

  const handleCopyAddress = () => {
    void globalThis.navigator.clipboard.writeText(state.address)
    setCopiedOpen(true)
    setPulseKey(current => current + 1)

    if (copiedTimer.current) {
      globalThis.clearTimeout(copiedTimer.current)
    }
    copiedTimer.current = globalThis.setTimeout(() => {
      setCopiedOpen(false)
    }, CLOSE_POPOVER)
  }

  const iconProps = {
    animate: { opacity: 1, y: 0 },
    className: 'absolute inset-0',
    exit: { opacity: 0, y: -2 },
    initial: { opacity: 0, y: 2 },
    transition: { duration: ICON_SWAP },
  }

  return (
    <Popover onOpenChange={setCopiedOpen} open={copiedOpen}>
      <PopoverTrigger asChild>
        <Button
          className="relative overflow-hidden"
          size="sm"
          variant="outline"
          type="button"
          onClick={handleCopyAddress}
        >
          {pulseKey > 0 && (
            <motion.span
              animate={{ opacity: 0, scale: PULSE_SCALE }}
              className="pointer-events-none absolute inset-0 rounded-[inherit] border border-emerald-500"
              initial={{ opacity: 0.9, scale: 1 }}
              key={pulseKey}
              transition={{
                duration: PULSE_DURATION,
                ease: 'easeOut',
              }}
            />
          )}
          Address
          <span className="relative size-4" data-icon="inline-end">
            <AnimatePresence initial={false} mode="wait">
              {copiedOpen ? (
                <motion.span {...iconProps} key="check">
                  <Check className="size-4 text-emerald-500" />
                </motion.span>
              ) : (
                <motion.span {...iconProps} key="copy">
                  <Copy className="size-4" />
                </motion.span>
              )}
            </AnimatePresence>
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto px-3 py-2 text-sm" side="bottom">
        Copied
      </PopoverContent>
    </Popover>
  )
}
