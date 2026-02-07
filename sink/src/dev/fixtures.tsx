import { type Getter, type Setter, useAtom, type WritableAtom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { useAtomsSnapshot, useGotoAtomsSnapshot } from 'jotai-devtools'
import { CheckIcon, CircleIcon, CircleOffIcon, CopyIcon } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'

import {
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command.tsx'

interface FixtureValueEntry {
  value: unknown
}
type FixtureRead = (get: Getter) => unknown
type FixtureWrite = (get: Getter, set: Setter, ...args: unknown[]) => unknown
interface FixtureComputedEntry {
  read: FixtureRead
  write?: FixtureWrite
}
type FixtureRecord = Record<string, FixtureValueEntry | FixtureComputedEntry>

interface Fixture {
  default: FixtureRecord
}

const fixtureValueEntrySchema = z
  .object({
    value: z.unknown(),
  })
  .strict()
  .transform(value => value as FixtureValueEntry)

const fixtureComputedEntrySchema = z
  .object({
    read: z.custom<FixtureRead>(value => typeof value === 'function'),
    write: z
      .custom<FixtureWrite>(value => typeof value === 'function')
      .optional(),
  })
  .strict()
  .transform(value => value as FixtureComputedEntry)

const fixtureEntrySchema = z.union([
  fixtureValueEntrySchema,
  fixtureComputedEntrySchema,
])

const fixtureSchema = z.record(z.string(), fixtureEntrySchema)

const fixtures = import.meta.glob<Fixture>('^/fixtures/**/*.ts')
const fixturePaths = Object.keys(fixtures)

const fixtureNameFromPath = (path: string) => {
  const parts = path.split('fixtures/')
  const last = parts[parts.length - 1]
  return last ? last.replace(/\.ts$/, '') : path
}

const selectedFixtureAtom = atomWithStorage<string | null>(
  'selectedFixture',
  fixturePaths[0] ?? null,
)
selectedFixtureAtom.debugPrivate = true

type AtomSnapshot = ReturnType<typeof useAtomsSnapshot>
class FixtureNotFoundError extends Error {}
class FixtureParseError extends Error {
  constructor(public readonly zodError: z.ZodError) {
    super('Fixture parse failed')
  }
}

const loadFixture = async (path: string): Promise<FixtureRecord> => {
  const load = fixtures[path]
  const fixture = (await load?.())?.default ?? null
  if (!fixture) {
    throw new FixtureNotFoundError('Fixture not found')
  }

  const parsedFixture = fixtureSchema.safeParse(fixture)
  if (!parsedFixture.success) {
    throw new FixtureParseError(parsedFixture.error)
  }

  return parsedFixture.data
}

const resolveExportValue = async (value: unknown) => {
  if (!(value instanceof Promise)) {
    return { kind: 'value', value } as const
  }

  return await Promise.race([
    value.then(
      resolved => ({ kind: 'value', value: resolved }) as const,
      error => ({ kind: 'rejected', error }) as const,
    ),
    new Promise<{ kind: 'pending' }>(resolve => {
      setTimeout(() => resolve({ kind: 'pending' }), 0)
    }),
  ])
}

function defaultRead(get) {
  return get(this)
}

function defaultWrite(get, set, arg) {
  return set(this, typeof arg === 'function' ? arg(get(this)) : arg)
}

const nextSnapshot = (snapshot: AtomSnapshot, fixture: FixtureRecord) => {
  const appliedLabels = new Set<string>()
  const values = Array.from(snapshot.values).reduce((acc, [key, _]) => {
    const mutable = key as WritableAtom<unknown, unknown[], unknown> & {
      init?: unknown
    }

    if (!key.debugLabel) {
      return acc
    }

    const entry = fixture[key.debugLabel]
    if (!entry) {
      return acc
    }
    appliedLabels.add(key.debugLabel)

    if ('value' in entry) {
      mutable.init = entry.value
      mutable.read = defaultRead

      if ('write' in key) {
        mutable.write = defaultWrite
      }

      acc.set(key, entry.value)
    } else if ('init' in mutable) {
      console.warn(
        `you can't convert primitive atoms to computed ones: ${key.debugLabel}`,
      )
    } else {
      mutable.read = entry.read
      if (entry.write) {
        mutable.write = entry.write
      }
    }

    return acc
  }, new Map(snapshot.values))

  const unknownAtoms = Object.keys(fixture).filter(
    label => !appliedLabels.has(label),
  )

  return {
    next: {
      values,
      dependents: new Map(snapshot.dependents),
    },
    unknownAtoms,
  }
}

export const FixturesCommand = ({ onDone }: { onDone?: () => void }) => {
  const [current, setCurrent] = useAtom(selectedFixtureAtom)
  const selectedName = current ? fixtureNameFromPath(current) : null

  const snapshot = useAtomsSnapshot()
  const setSnapshot = useGotoAtomsSnapshot()

  const disableFixtureOverrides = () => {
    setCurrent(null)
    toast.success('Fixture overrides disabled')
    onDone?.()
  }

  const exportFixture = async () => {
    const values: Record<string, { value: unknown }> = {}
    const pendingLabels: string[] = []

    for (const [key, value] of snapshot.values) {
      if (!key.debugLabel) {
        continue
      }

      const resolved = await resolveExportValue(value)
      if (resolved.kind === 'value') {
        values[key.debugLabel] = { value: resolved.value }
        continue
      }

      if (resolved.kind === 'pending') {
        pendingLabels.push(key.debugLabel)
      } else {
        console.warn(
          `Skipping rejected atom while exporting fixture: ${key.debugLabel}`,
          resolved.error,
        )
      }
    }

    const output = `export default ${JSON.stringify(values, null, 2)}\n`

    await navigator.clipboard.writeText(output)
    toast.success('Fixture copied to clipboard')
    if (pendingLabels.length > 0) {
      toast.warning(
        `Skipped pending atoms while exporting: ${pendingLabels.join(', ')}`,
      )
    }
  }

  const applyFixture = async (path: string) => {
    if (snapshot.values.size === 0) {
      return
    }

    let fixture: FixtureRecord
    try {
      fixture = await loadFixture(path)
    } catch (error) {
      if (error instanceof FixtureParseError) {
        toast.error('Fixture parse failed', {
          description: 'Check the console for more details',
        })
        console.warn('Invalid fixture', z.treeifyError(error.zodError))
      } else if (error instanceof FixtureNotFoundError) {
        toast.error('Fixture not found', {
          description: 'Check the console for more details',
        })
      } else {
        throw error
      }
      return
    }

    const { next, unknownAtoms } = nextSnapshot(snapshot, fixture)
    if (unknownAtoms.length > 0) {
      toast.warning(`Unknown fixture atoms: ${unknownAtoms.join(', ')}`)
    }

    // When converting a computed atom to a primitive one *at the same time* as
    // its dependent, these set* functions will throw that there's an
    // invalidated atom. For now, we're ignoring that error as it doesn't seem
    // to have any other implications.
    try {
      setSnapshot(next)
      setCurrent(path)
    } catch (error) {
      if (
        !(
          error instanceof Error &&
          error.message.includes('[Bug] invalidated atom exists')
        )
      ) {
        throw error
      }
    }
    const name = fixtureNameFromPath(path)
    toast.success(`Applied fixture: ${name}`)
  }

  return (
    <>
      <CommandGroup heading="Fixtures">
        <CommandItem
          onSelect={() =>
            void exportFixture()
              .catch(error => {
                console.warn('Failed to copy fixture to clipboard', error)
                toast.error('Fixture export failed', {
                  description: 'Check the console for more details',
                })
              })
              .finally(() => onDone?.())
          }
        >
          <CopyIcon />
          Export fixture to clipboard
        </CommandItem>
        <CommandItem onSelect={disableFixtureOverrides}>
          <CircleOffIcon />
          Disable fixture overrides
        </CommandItem>
        {fixturePaths.map(path => {
          const name = fixtureNameFromPath(path)
          const isSelected = selectedName === name
          return (
            <CommandItem
              key={path}
              onSelect={() =>
                void applyFixture(path)
                  .catch(error => {
                    console.warn('Failed to apply fixture', error)
                    toast.error('Fixture apply failed', {
                      description: 'Check the console for more details',
                    })
                  })
                  .finally(() => onDone?.())
              }
            >
              {isSelected ? (
                <CheckIcon className="text-primary" />
              ) : (
                <CircleIcon className="text-muted-foreground" />
              )}
              {`Apply fixture: ${name}`}
            </CommandItem>
          )
        })}
      </CommandGroup>
      <CommandSeparator />
    </>
  )
}
