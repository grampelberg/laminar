import {
  type Getter,
  type Setter,
  useAtom,
  useAtomValue,
  useSetAtom,
  type WritableAtom,
} from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { useAtomsSnapshot, useGotoAtomsSnapshot } from 'jotai-devtools'
import { CheckIcon, CircleIcon, CircleOffIcon, CopyIcon } from 'lucide-react'
import { err, ok, Result, type ResultAsync } from 'neverthrow'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

import {
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command.tsx'

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

export const currentFixtureAtom = atomWithStorage<string | null>(
  'currentFixture',
  null,
)
currentFixtureAtom.debugPrivate = true

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

export const FixturesCommand = ({ onDone }: { onDone?: () => void }) => {
  const setCurrent = useSetAtom(currentFixtureAtom)

  const snapshot = useAtomsSnapshot()

  const disableFixtureOverrides = () => {
    setCurrent(null)
    toast.success('Fixture overrides disabled')
    onDone?.()
  }

  const exportFixture = async () => {
    const values: Fixture = {}
    const pendingLabels: string[] = []

    for (const [key, value] of snapshot.values) {
      if (!key.debugLabel) {
        continue
      }

      const resolved = await resolveExportValue(value)

      switch (resolved.kind) {
        case 'value':
          values[key.debugLabel] = { value: resolved.value }
          continue
        case 'pending':
          pendingLabels.push(key.debugLabel)
          continue
        case 'rejected':
          console.warn(
            `Async atom was rejected, skipping: ${key.debugLabel}`,
            resolved.error,
          )
      }
    }

    await navigator.clipboard.writeText(
      `export default ${JSON.stringify(values, null, 2)}`,
    )

    toast.success('Fixture copied to clipboard')

    if (pendingLabels.length > 0) {
      toast.warning(
        `Skipped pending atoms while exporting: ${pendingLabels.join(', ')}`,
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
