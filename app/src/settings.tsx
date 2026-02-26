import * as VisuallyHidden from '@radix-ui/react-visually-hidden'
import { cva } from 'class-variance-authority'
import { useAtom } from 'jotai'
import { clamp } from 'lodash-es'
import { MinusIcon, PlusIcon, Settings2Icon } from 'lucide-react'
import { type FocusEvent, useRef } from 'react'
import { useRoute, useLocation } from 'wouter'
import { z } from 'zod'

import { Button } from '@/components/ui/button.tsx'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldTitle,
} from '@/components/ui/field.tsx'
import { Input } from '@/components/ui/input.tsx'
import { Separator } from '@/components/ui/separator.tsx'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet.tsx'
import { remoteAtom, displayNameAtom, retentionAtom } from '@/config.ts'
import { routes } from '@/routes.ts'
import { getLogger } from '@/utils'

const logger = getLogger(import.meta.url)

const MAX_RETENTION_DAYS = 30
const settingsValueClass = cva(
  'flex-none w-52 [&_[data-slot=input]]:text-right',
)
const remoteSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9]{64}$/i, {
    message: 'Remote must be exactly 64 base32 characters (A-Z, 2-7).',
  })

const RemoteConfig = () => {
  const [remote, setRemote] = useAtom(remoteAtom)

  const set = (ev: FocusEvent<HTMLInputElement>) => {
    const target = ev.currentTarget

    const next = target.value.trim()
    if (next === '') {
      target.setCustomValidity('')
      void setRemote('')
      return
    }

    const parsed = remoteSchema.safeParse(next)
    if (!parsed.success) {
      target.setCustomValidity(
        parsed.error.issues[0]?.message ?? 'Invalid remote value.',
      )
      target.reportValidity()
      return
    }

    target.setCustomValidity('')
    void setRemote(next)
  }

  return (
    <Field orientation="horizontal">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <FieldTitle className="text-sm font-medium">Remote</FieldTitle>
        <FieldDescription>Remote endpoint identifier.</FieldDescription>
      </div>
      <FieldContent className={settingsValueClass()}>
        <Input
          defaultValue={remote}
          key={remote}
          onBlur={set}
          onInput={event => event.currentTarget.setCustomValidity('')}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.currentTarget.blur()
            }
          }}
        />
      </FieldContent>
    </Field>
  )
}

const NameConfig = () => {
  const [displayName, setDisplayName] = useAtom(displayNameAtom)

  return (
    <Field orientation="horizontal">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <FieldTitle className="text-sm font-medium">Display Name</FieldTitle>
        <FieldDescription>Label shown in exported records.</FieldDescription>
      </div>
      <FieldContent className={settingsValueClass()}>
        <Input
          defaultValue={displayName}
          key={displayName}
          onBlur={event => {
            void setDisplayName(event.currentTarget.value)
          }}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.currentTarget.blur()
            }
          }}
        />
      </FieldContent>
    </Field>
  )
}

const RetentionConfig = () => {
  const [retention, setRetention] = useAtom(retentionAtom)

  const retentionFromInput = (value: string) => {
    const parsed = Number.parseFloat(value)

    if (Number.isNaN(parsed)) {
      return
    }

    setRetention(clamp(parsed, 0, MAX_RETENTION_DAYS))
  }

  return (
    <Field orientation="horizontal">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <FieldTitle className="text-sm font-medium">Retention</FieldTitle>
        <FieldDescription>Days before pruning.</FieldDescription>
      </div>

      <FieldContent className={settingsValueClass()}>
        <div className="flex gap-2">
          <Button
            onClick={() =>
              setRetention(val => clamp(val - 1, 0, MAX_RETENTION_DAYS))
            }
            size="icon"
            type="button"
            variant="outline"
          >
            <MinusIcon />
          </Button>
          <Input
            min={0}
            onChange={event => retentionFromInput(event.target.value)}
            step={1}
            type="number"
            value={retention}
          />
          <Button
            onClick={() =>
              setRetention(val => clamp(val + 1, 0, MAX_RETENTION_DAYS))
            }
            size="icon"
            type="button"
            variant="outline"
          >
            <PlusIcon />
          </Button>
        </div>
      </FieldContent>
    </Field>
  )
}

export const Settings = () => {
  const [isOpen] = useRoute(routes.settings)
  const [_location, navigate] = useLocation()
  const contentRef = useRef<HTMLDivElement>(null)

  return (
    <Sheet
      open={isOpen}
      onOpenChange={open =>
        open ? navigate(routes.settings) : globalThis.window.history.back()
      }
    >
      <SheetTrigger asChild>
        <Button size="sm" type="button" variant="outline">
          Settings
          <Settings2Icon />
        </Button>
      </SheetTrigger>
      <SheetContent
        ref={contentRef}
        onOpenAutoFocus={event => {
          event.preventDefault()
          contentRef.current?.focus()
        }}
        tabIndex={-1}
        side="right"
      >
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <VisuallyHidden.Root asChild>
            <SheetDescription>
              Configure application specific settings and behavior.
            </SheetDescription>
          </VisuallyHidden.Root>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-4">
          <Field>
            <FieldTitle className="text-base font-semibold tracking-tight">
              Destination
            </FieldTitle>
            <Separator />
            <FieldGroup className="gap-3">
              <RemoteConfig />
              <NameConfig />
            </FieldGroup>
          </Field>

          <Field>
            <FieldTitle className="text-base font-semibold tracking-tight">
              Storage
            </FieldTitle>
            <Separator />
            <RetentionConfig />
          </Field>
        </div>
      </SheetContent>
    </Sheet>
  )
}
