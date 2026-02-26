import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { BugIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'

import { Button } from '@/components/ui/button.tsx'
import {
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandList,
} from '@/components/ui/command.tsx'
import { DebugCommand } from '@/dev/debug.tsx'
import { FixturesCommand } from '@/dev/fixtures.tsx'
import { FixtureRuntime } from '@/dev/fixtures/runtime.tsx'

const HOVER_DISTANCE = 140
const HOVER_MAX_SCALE = 1.3
const HOVER_MIN_SCALE = 1

export const DevCommands = () => {
  const [open, setOpen] = useState(false)

  useHotkeys(
    'meta+p,ctrl+p',
    event => {
      event.preventDefault()
      setOpen(current => !current)
    },
    { preventDefault: true },
  )

  return (
    <>
      {/* Actions */}
      <FixtureRuntime />

      {/* UI */}
      <HoverFocus className="fixed bottom-4 left-4 z-50">
        <Button
          aria-label="Open developer commands"
          className="size-10 rounded-full shadow-lg"
          onClick={() => setOpen(true)}
          size="icon"
          type="button"
          variant="secondary"
        >
          <BugIcon />
        </Button>
      </HoverFocus>
      <CommandDialog onOpenChange={setOpen} open={open}>
        <CommandInput placeholder="Run development command..." />
        <CommandList>
          <CommandEmpty>No dev commands found.</CommandEmpty>
          <FixturesCommand onDone={() => setOpen(false)} />
          <DebugCommand onDone={() => setOpen(false)} />
        </CommandList>
      </CommandDialog>
    </>
  )
}

const HoverFocus = ({
  children,
  className,
}: {
  children: React.ReactNode
  className: string
}) => {
  const buttonRef = useRef<HTMLDivElement>(null)
  const distance = useMotionValue(HOVER_DISTANCE)
  const scale = useTransform(
    distance,
    [0, HOVER_DISTANCE],
    [HOVER_MAX_SCALE, HOVER_MIN_SCALE],
  )
  const smoothScale = useSpring(scale, {
    damping: 22,
    stiffness: 260,
  })

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const rect = buttonRef.current?.getBoundingClientRect()
      if (!rect) {
        return
      }

      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      distance.set(Math.hypot(event.clientX - centerX, event.clientY - centerY))
    }

    const resetDistance = () => {
      distance.set(HOVER_DISTANCE)
    }

    globalThis.addEventListener('pointermove', handlePointerMove)
    globalThis.addEventListener('pointerleave', resetDistance)
    return () => {
      globalThis.removeEventListener('pointermove', handlePointerMove)
      globalThis.removeEventListener('pointerleave', resetDistance)
    }
  }, [distance])

  return (
    <motion.div
      className={className}
      ref={buttonRef}
      style={{ scale: smoothScale }}
    >
      {children}
    </motion.div>
  )
}
