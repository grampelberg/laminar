import { atom, useAtom } from 'jotai'

import { Button } from '@/components/ui/button.tsx'
export const countAtom = atom(0)
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
    <SnapshotThing />
  </div>
)
