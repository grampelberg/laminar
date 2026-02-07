import { atom, useAtom, useAtomValue } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { useAtomsSnapshot, useGotoAtomsSnapshot } from 'jotai-devtools'
import { useEffect } from 'react'

import { Button } from '@/components/ui/button.tsx'
import { Label } from '@/components/ui/label.tsx'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.tsx'
import { FixturePanel } from '@/dev/fixtures.tsx'

const otherAtom = atom(0)
const countAtom = atom(0)
const compoundingAtom = atom(get => get(countAtom) + 10)

const SnapshotThing = () => {
  const [count, setCount] = useAtom(countAtom)
  const [compounding] = useAtom(compoundingAtom)

  const fastForward = () => {
    setCount(count + 100)
  }

  return (
    <div className="flex flex-row gap-2 p-8">
      <Button onClick={() => setCount(count + 1)} type="button">
        Design Space: {count} {compounding}
      </Button>
      <Button onClick={fastForward}>Fast forward</Button>
    </div>
  )
}

export const DesignPlayground = () => (
  <div>
    <FixturePanel />

    <SnapshotThing />
  </div>
)
