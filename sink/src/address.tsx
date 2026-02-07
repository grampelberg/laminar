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
import { useMock } from '@/mock.ts'

const addressAtom = atom(
  useMock ? async () => '' : async () => await invoke<string>('get_address'),
)

export const AddressButton = () => {
  const address = useAtomValue(addressAtom)
  const [copiedOpen, setCopiedOpen] = useState(false)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (copiedTimer.current) {
        clearTimeout(copiedTimer.current)
      }
    },
    [],
  )

  const handleCopyAddress = () => {
    console.log(address)

    void navigator.clipboard.writeText(address)
    setCopiedOpen(true)

    if (copiedTimer.current) {
      clearTimeout(copiedTimer.current)
    }
    copiedTimer.current = setTimeout(() => {
      setCopiedOpen(false)
    }, 1000)
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
