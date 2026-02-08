import { invoke } from '@tauri-apps/api/core'
import { atom, useAtomValue } from 'jotai'
import { Copy } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button.tsx'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover.tsx'
import { log } from '@/log.ts'
import { useMock } from '@/mock.ts'

const logger = log(import.meta.url)

const addressAtom = atom(
  useMock ? async () => '' : async () => await invoke<string>('get_address'),
)
const COPY_FEEDBACK_MS = 1000

export const AddressButton = () => {
  const address = useAtomValue(addressAtom)
  const [copiedOpen, setCopiedOpen] = useState(false)
  const copiedTimer = useRef<ReturnType<typeof globalThis.setTimeout> | null>(
    null,
  )

  useEffect(
    () => () => {
      if (copiedTimer.current) {
        globalThis.clearTimeout(copiedTimer.current)
      }
    },
    [],
  )

  const handleCopyAddress = () => {
    void globalThis.navigator.clipboard.writeText(address)
    setCopiedOpen(true)

    if (copiedTimer.current) {
      globalThis.clearTimeout(copiedTimer.current)
    }
    copiedTimer.current = globalThis.setTimeout(() => {
      setCopiedOpen(false)
    }, COPY_FEEDBACK_MS)
  }

  return (
    <Popover onOpenChange={setCopiedOpen} open={copiedOpen}>
      <PopoverTrigger asChild>
        <Button
          onClick={handleCopyAddress}
          size="sm"
          type="button"
          variant="outline"
        >
          Address
          <Copy data-icon="inline-end" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto px-3 py-2 text-sm" side="bottom">
        Copied
      </PopoverContent>
    </Popover>
  )
}
