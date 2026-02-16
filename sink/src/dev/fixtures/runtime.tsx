import { type Atom, type Getter, type Setter, useAtomValue } from 'jotai'
import { useAtomsSnapshot, useGotoAtomsSnapshot } from 'jotai-devtools'
import { intersection } from 'lodash-es'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import {
  allFixtures,
  currentFixtureAtom,
  fixtureSchema,
  toName,
  type Fixture,
  type PrimitiveItem,
} from '@/dev/fixtures.tsx'
import { getLogger } from '@/utils.ts'

const logger = getLogger(import.meta.url)

type AtomConfig = Atom<unknown> & {
  read: (get: Getter) => unknown
  write?: (get: Getter, set: Setter, ...args: unknown[]) => unknown
  init?: unknown
  debugLabel?: string
}

const hasDebugLabel = (
  atom: Atom<unknown>,
): atom is Atom<unknown> & { debugLabel: string } =>
  atom.debugLabel !== undefined

const loadFixture = async (path: string) => {
  const fixture = (await allFixtures[path]?.())?.default ?? null
  if (!fixture) {
    throw new Error(`Fixture not found: ${path}`)
  }

  const parsedFixture = fixtureSchema.safeParse(fixture)
  if (!parsedFixture.success) {
    throw parsedFixture.error
  }

  return parsedFixture.data
}

function primitiveRead(this: AtomConfig, get: Getter) {
  return get(this)
}

function primitiveWrite(
  this: AtomConfig,
  get: Getter,
  set: Setter,
  arg: unknown,
) {
  return set(this as never, typeof arg === 'function' ? arg(get(this)) : arg)
}

const toPrimitive = (atom: Atom<unknown>, item: PrimitiveItem) => {
  const mutableAtom = atom as AtomConfig
  mutableAtom.init = item.value
  mutableAtom.read = primitiveRead

  if ('write' in mutableAtom) {
    mutableAtom.write = primitiveWrite
  }
}

const applySnapshot = (
  set: (snapshot: {
    values: Map<Atom<unknown>, unknown>
    dependents: Map<Atom<unknown>, Set<Atom<unknown>>>
  }) => void,
  atoms: Iterable<Atom<unknown>>,
  fixture: Fixture,
) => {
  const appliedLabels = new Set<string>()

  for (const atom of atoms) {
    if (!atom.debugLabel) {
      continue
    }

    const entry = fixture[atom.debugLabel]
    if (!entry) {
      continue
    }

    if (!('value' in entry)) {
      throw new Error(
        `"value" is the only supported property: ${atom.debugLabel}`,
      )
    }

    appliedLabels.add(atom.debugLabel)
    toPrimitive(atom, entry)

    // Set values individually. This sidesteps any potential issues that could
    // arise from setting an atom and its dependencies at once. `setSnapshot`
    // doesn't reset the store's state, it just overrides the atoms that you
    // pass in. This behavior allows us to do it incrementally and make sure
    // there are no invalidation clashes with state.
    set({
      values: new Map([[atom, entry.value]]),
      dependents: new Map(),
    })
  }

  return Object.keys(fixture).filter(label => !appliedLabels.has(label))
}

export const FixtureRuntime = () => {
  const current = useAtomValue(currentFixtureAtom)

  // This ensures that `useAtomSnapshot()` only triggers if we're actually
  // interested in applying a fixture. It protects from aggressive re-renders in
  // the runtime component for most use cases.
  return current ? <ApplySelectedFixture key={current} path={current} /> : null
}

const ApplySelectedFixture = ({ path }: { path: string }) => {
  const [fixture, setFixture] = useState<Fixture>({})
  const snapshot = useAtomsSnapshot()
  const setSnapshot = useGotoAtomsSnapshot()

  // The snapshot is going to change somewhat regularly as either values change
  // or atoms are mounted/unmounted. We are only ever going to apply the fixture
  // if there are atoms that are interesting to us. This filters out anything
  // we're not interested in and triggers only on length changes. It should
  // protect from rendering loops and the like.
  const fixtureItems = intersection(
    Object.keys(fixture),
    [...snapshot.values.keys()].filter(hasDebugLabel).map(a => a.debugLabel),
  ).length

  useEffect(() => {
    ;(async () => {
      try {
        setFixture(await loadFixture(path))
      } catch (e) {
        toast.error(`Fixture not found: ${path}`)
      }
    })()
  }, [path])

  useEffect(() => {
    if (fixtureItems === 0) {
      return
    }

    try {
      let ignored = applySnapshot(setSnapshot, snapshot.values.keys(), fixture)
      if (ignored.length > 0) {
        toast.warning(ignored.join(', '), {
          description: 'Fixture contains atoms that have been ignored.',
        })
      }
    } catch (e) {
      toast.error('Unhandled error applying fixture', {
        description: 'Check the console for more details',
      })

      throw e
    }

    toast.success(`Applied fixture: ${toName(path)}`)
  }, [setSnapshot, fixtureItems])

  return null
}

export const __test = {
  ApplySelectedFixture,
}
