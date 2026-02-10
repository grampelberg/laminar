import { useMotionValue, useMotionValueEvent, useSpring } from 'framer-motion'
import { useAtomValue } from 'jotai'
import { useEffect, useState } from 'react'

import { totalRowsAtom } from '@/db'

export const RowCount = () => {
  const total = useAtomValue(totalRowsAtom)
  const motionTotal = useMotionValue(total)
  const springTotal = useSpring(motionTotal, {
    damping: 28,
    mass: 0.4,
    stiffness: 320,
  })
  const [displayTotal, setDisplayTotal] = useState(total)

  useMotionValueEvent(springTotal, 'change', latest => {
    setDisplayTotal(Math.round(latest))
  })

  useEffect(() => {
    motionTotal.set(total)
  }, [motionTotal, total])

  return (
    <span
      key={total}
      className="animate-[total-rows-flash_1200ms_ease-out] tabular-nums"
    >
      Total rows: {displayTotal.toLocaleString()}
    </span>
  )
}
