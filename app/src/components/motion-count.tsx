import { useMotionValue, useMotionValueEvent, useSpring } from 'framer-motion'
import { useEffect, useRef } from 'react'

export interface MotionCountProps {
  value: number
}

export const MotionCount = ({ value }: MotionCountProps) => {
  const motionValue = useMotionValue(value)
  const springValue = useSpring(motionValue, {
    damping: 28,
    mass: 0.4,
    stiffness: 320,
  })
  const displayRef = useRef<HTMLSpanElement>(null)

  useMotionValueEvent(springValue, 'change', latest => {
    if (displayRef.current) {
      displayRef.current.textContent = Math.round(latest).toLocaleString()
    }
  })

  useEffect(() => {
    motionValue.set(value)
  }, [motionValue, value])

  return <span ref={displayRef}>{value.toLocaleString()}</span>
}
