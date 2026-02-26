import { useAtomValue } from 'jotai'
import { useEffect, useRef } from 'react'

import { MotionCount } from '@/components/motion-count'
import { totalAtom } from '@/records/data.tsx'
import { Filters } from '@/records/filters'

export const Controls = () => {
  const total = useAtomValue(totalAtom)
  const colorRef = useRef<HTMLSpanElement>(null)

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
    <div className="border-b px-4 py-2 text-sm">
      <div className="flex items-center justify-between gap-4 text-muted-foreground">
        <Filters />
        <span ref={colorRef} className="animate-from-color [--duration:1000ms]">
          Showing: <MotionCount value={total} />
        </span>
      </div>
    </div>
  )
}
