import { atom, useAtom, useAtomValue } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { useAtomsSnapshot, useGotoAtomsSnapshot } from 'jotai-devtools'
import { useEffect } from 'react'

import { Label } from '@/components/ui/label.tsx'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.tsx'

interface Fixture {
  default: Record<string, unknown>
}

const fixtures = import.meta.glob<Fixture>('^/fixtures/*.ts')
const fixturePaths = Object.keys(fixtures).sort()

const selectedFixtureAtom = atomWithStorage<string | null>(
  'selectedFixture',
  fixturePaths[0] ?? null,
)
selectedFixtureAtom.debugPrivate = true

const fixtureAtom = atom(async get => {
  const path = get(selectedFixtureAtom)
  const load = path ? fixtures[path] : undefined
  return (await load?.())?.default ?? null
})
fixtureAtom.debugPrivate = true

export const FixturePanel = () => {
  const [current, setCurrent] = useAtom(selectedFixtureAtom)
  const fixture = useAtomValue(fixtureAtom)

  const snapshot = useAtomsSnapshot()
  const setSnapshot = useGotoAtomsSnapshot()

  useEffect(() => {
    if (snapshot.values.size === 0 || !fixture) {
      return
    }

    const toAtom = Array.from(snapshot.values).reduce((acc, [key, _]) => {
      acc.set(key.debugLabel, key)
      return acc
    }, new Map())

    const next = {
      values: Object.entries(fixture).reduce((acc, [key, value]) => {
        if (!toAtom.has(key)) {
          console.warn(`Fixture has unknown atom: ${key}`)
          return acc
        }

        acc.set(toAtom.get(key), value)
        return acc
      }, new Map()),
      dependents: new Map(),
    }

    setSnapshot(next)
  }, [current, setSnapshot, snapshot.values.size])

  return (
    <div className="flex flex-col gap-2 p-8">
      <div className="flex items-center gap-2">
        <Label htmlFor="fixture-select">Fixture</Label>
        <Select onValueChange={setCurrent} value={current ?? undefined}>
          <SelectTrigger id="fixture-select">
            <SelectValue placeholder="Select fixture" />
          </SelectTrigger>
          <SelectContent>
            {fixturePaths.map(path => (
              <SelectItem key={path} value={path}>
                {path.split('/').pop()?.replace('.ts', '') ?? path}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <pre className="rounded-md border p-3 text-sm">
        {JSON.stringify(fixture, null, 2)}
      </pre>
    </div>
  )
}
