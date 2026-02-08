import { type Atom, type Getter, type Setter, useAtom, useSetAtom } from 'jotai'
import { useAtomsSnapshot } from 'jotai-devtools'
import { atomWithStorage } from 'jotai/utils'
import { CheckIcon, CircleIcon, CircleOffIcon, CopyIcon } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'

import {
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command.tsx'

const INDENT = 2

type Snapshot = Map<Atom<unknown>, unknown>

type ReadFn = (get: Getter) => unknown
type WriteFn = (get: Getter, set: Setter, ...args: unknown[]) => unknown

const primitiveSchema = z
  .object({
    value: z.unknown(),
  })
  .strict()

const derivedSchema = z
  .object({
    read: z.custom<ReadFn>(value => typeof value === 'function'),
    write: z.custom<WriteFn>(value => typeof value === 'function').optional(),
  })
  .strict()

const itemSchema = z.union([primitiveSchema, derivedSchema])
export const fixtureSchema = z.record(z.string(), itemSchema)

export type Fixture = z.infer<typeof fixtureSchema>
export type PrimitiveItem = z.infer<typeof primitiveSchema>
export type DerivedItem = z.infer<typeof derivedSchema>

export const allFixtures = import.meta.glob<{ default: Fixture }>(
  '^/fixtures/**/*.ts',
)

export const toName = (path: string) => {
  const parts = path.split('fixtures/')
  const last = parts[parts.length - 1]
  return last ? last.replace(/\.ts$/, '') : path
}

export const currentFixtureAtom = atomWithStorage<string | undefined>(
  'currentFixture',
  undefined,
)
currentFixtureAtom.debugPrivate = true

const resolveExportValue = async (value: unknown) => {
  if (!(value instanceof Promise)) {
    return { kind: 'value', value } as const
  }

  return await Promise.race([
    value.then(
      resolved => ({ kind: 'value', value: resolved }) as const,
      error => ({ error, kind: 'rejected' }) as const,
    ),
    new Promise<{ kind: 'pending' }>(resolve => {
      globalThis.setTimeout(() => resolve({ kind: 'pending' }), 0)
    }),
  ])
}

const buildExport = async (snapshot: Snapshot) => {
  const values: Fixture = {}
  const pending: string[] = []

  for (const [key, value] of snapshot) {
    if (!key.debugLabel) {
      continue
    }

    const resolved = await resolveExportValue(value)

    switch (resolved.kind) {
      case 'value': {
        values[key.debugLabel] = { value: resolved.value }
        continue
      }
      case 'pending': {
        pending.push(key.debugLabel)
        continue
      }
      case 'rejected': {
        globalThis.console.warn(
          `Async atom was rejected, skipping: ${key.debugLabel}`,
          resolved.error,
        )
      }
    }
  }

  return {
    pending,
    values,
  }
}

export const FixturesCommand = ({ onDone }: { onDone?: () => void }) => {
  const setCurrent = useSetAtom(currentFixtureAtom)

  const snapshot = useAtomsSnapshot()

  const disableFixtureOverrides = () => {
    setCurrent(undefined)
    toast.success('Fixture overrides disabled')
    onDone?.()
  }

  const exportFixture = async () => {
    const { pending, values } = await buildExport(snapshot.values)

    await globalThis.navigator.clipboard.writeText(
      `export default ${JSON.stringify(values, undefined, INDENT)}`,
    )

    toast.success('Fixture copied to clipboard')

    if (pending.length > 0) {
      toast.warning(
        `Skipped pending atoms while exporting: ${pending.join(', ')}`,
      )
    }
  }

  return (
    <>
      <CommandGroup heading="Fixtures">
        <CommandItem
          onSelect={() =>
            void exportFixture()
              .catch(error => {
                globalThis.console.warn(
                  'Failed to copy fixture to clipboard',
                  error,
                )
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
        {Object.keys(allFixtures).map(path => (
          <FixtureItem key={path} path={path} onDone={onDone} />
        ))}
      </CommandGroup>
      <CommandSeparator />
    </>
  )
}

const FixtureItem = ({
  path,
  onDone,
}: {
  path: string
  onDone?: () => void
}) => {
  const [current, setCurrent] = useAtom(currentFixtureAtom)

  return (
    <CommandItem
      key={path}
      onSelect={() => {
        setCurrent(path)
        onDone?.()
      }}
    >
      {path === current ? (
        <CheckIcon className="text-primary" />
      ) : (
        <CircleIcon className="text-muted-foreground" />
      )}
      {`Apply fixture: ${toName(path)}`}
    </CommandItem>
  )
}
