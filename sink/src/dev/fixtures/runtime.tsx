import {
  type Getter,
  type Setter,
  type WritableAtom,
  useAtomValue,
} from 'jotai'
import { useAtomsSnapshot, useGotoAtomsSnapshot } from 'jotai-devtools'
import { Result, err, ok } from 'neverthrow'
import { useEffect } from 'react'
import { toast } from 'sonner'
import type { z } from 'zod'

import { log } from '@/log.ts'

import type { DerivedItem, Fixture, PrimitiveItem } from '../fixtures.tsx'
import {
  allFixtures,
  currentFixtureAtom,
  fixtureSchema,
  toName,
} from '../fixtures.tsx'

const logger = log(import.meta.url)

type AtomSnapshot = ReturnType<typeof useAtomsSnapshot>
type AtomConfig = WritableAtom<unknown, unknown[], unknown> & {
  init?: unknown
}

type FixtureError =
  | { kind: 'not_found'; path: string }
  | { kind: 'parse_failed'; error: z.ZodError }
  | { kind: 'invalidated' }
  | { kind: 'set_error'; error: unknown }

const loadFixture = async (
  path: string,
): Promise<Result<Fixture, FixtureError>> => {
  const fixture = (await allFixtures[path]?.())?.default ?? null
  if (!fixture) {
    return err({ kind: 'not_found', path })
  }

  const parsedFixture = fixtureSchema.safeParse(fixture)
  if (!parsedFixture.success) {
    return err({ error: parsedFixture.error, kind: 'parse_failed' })
  }

  return ok(parsedFixture.data)
}

function primitiveRead(
  this: WritableAtom<unknown, unknown[], unknown>,
  get: Getter,
) {
  return get(this)
}

function primitiveWrite(
  this: WritableAtom<unknown, unknown[], unknown>,
  get: Getter,
  set: Setter,
  arg: unknown,
) {
  return set(this, typeof arg === 'function' ? arg(get(this)) : arg)
}

const toPrimitive = (atom: AtomConfig, item: PrimitiveItem) => {
  atom.init = item.value
  atom.read = primitiveRead

  if ('write' in atom) {
    atom.write = primitiveWrite
  }
}

const toDerived = (atom: AtomConfig, item: DerivedItem) => {
  atom.read = item.read
  if (item.write) {
    atom.write = item.write
  }
}

const buildNext = (snapshot: AtomSnapshot, fixture: Fixture) => {
  const appliedLabels = new Set<string>()
  const values = new Map()

  for (const [atom, _] of snapshot.values) {
    if (!atom.debugLabel) {
      continue
    }

    const entry = fixture[atom.debugLabel]
    if (!entry) {
      continue
    }

    appliedLabels.add(atom.debugLabel)

    if ('value' in entry) {
      toPrimitive(atom as AtomConfig, entry)
      values.set(atom, entry.value)
    } else if ('init' in atom) {
      console.warn(
        `you can't convert primitive atoms to computed ones: ${atom.debugLabel}`,
      )
    } else {
      toDerived(atom as AtomConfig, entry)
    }
  }

  const notMounted = Object.keys(fixture).filter(
    label => !appliedLabels.has(label),
  )

  return {
    next: {
      dependents: new Map(snapshot.dependents),
      values,
    },
    notMounted,
  }
}

export const FixtureRuntime = () => {
  const current = useAtomValue(currentFixtureAtom)

  return current ? <ApplySelectedFixture key={current} path={current} /> : null
}

const ApplySelectedFixture = ({ path }: { path: string }) => {
  const snapshot = useAtomsSnapshot()
  const setSnapshot = useGotoAtomsSnapshot()

  useEffect(() => {
    if (snapshot.values.size === 0) {
      return
    }

    ;(async () => {
      ;(await loadFixture(path))
        .andThen(fixture => {
          const { next, notMounted } = buildNext(snapshot, fixture)
          if (notMounted.length > 0) {
            toast.warning(notMounted.join(', '), {
              description: 'Fixture contains atoms that are not mounted.',
            })
          }

          return Result.fromThrowable(
            () => setSnapshot(next),
            (error: unknown): FixtureError => {
              if (
                error instanceof Error &&
                error.message.includes('[Bug] invalidated atom exists')
              ) {
                return { kind: 'invalidated' }
              }

              return { error, kind: 'set_error' }
            },
          )()
        })
        .match(
          () => {
            toast.success(`Applied fixture: ${toName(path)}`)
          },
          error => {
            switch (error.kind) {
              case 'not_found': {
                toast.error(`Fixture not found: ${error.path}`)
                break
              }
              case 'parse_failed': {
                toast.error('Unable to parse fixture', {
                  description: 'Check the console for more details',
                })
                break
              }
              case 'set_error': {
                toast.error('Unhandled error applying fixture', {
                  description: 'Check the console for more details',
                })
                console.error(error.error)
                break
              }
            }
          },
        )
    })()
  }, [path, setSnapshot, snapshot.values.size])

  return null
}
