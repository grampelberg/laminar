import { useMotionValue, useMotionValueEvent, useSpring } from 'framer-motion'
import { useAtomValue } from 'jotai'
import { useEffect, useRef } from 'react'

import { totalRowsAtom } from '@/db'

// This should realistically be its own counting component as this point.
export const RowCount = () => {
  const total = useAtomValue(totalRowsAtom)
  const colorRef = useRef<HTMLSpanElement>(null)
  const motionTotal = useMotionValue(total)
  const springTotal = useSpring(motionTotal, {
    damping: 28,
    mass: 0.4,
    stiffness: 320,
  })
  const displayRef = useRef<HTMLSpanElement>(null)

  useMotionValueEvent(springTotal, 'change', latest => {
    if (displayRef.current) {
      displayRef.current.textContent = Math.round(latest).toLocaleString()
    }
  })

  useEffect(() => {
    motionTotal.set(total)
  }, [motionTotal, total])

  useEffect(() => {
    const element = colorRef.current
    if (!element) {
      return
    }

    element.classList.remove('animate-from-color')
    void element.offsetWidth
    element.classList.add('animate-from-color')
  }, [total])

  return (
    <span ref={colorRef} className="animate-from-color [--duration:1000ms]">
      Total rows: <span ref={displayRef}>{total.toLocaleString()}</span>
    </span>
  )
}
