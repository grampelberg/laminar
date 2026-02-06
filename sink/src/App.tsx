import { invoke } from '@tauri-apps/api/core'
import { atom, useAtomValue } from 'jotai'
import { Copy } from 'lucide-react'
import { Suspense, useEffect, useRef, useState } from 'react'

import { Button } from './components/ui/button.tsx'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './components/ui/popover.tsx'
import { useRowsUpdates } from './db/updates.tsx'
import { RecordsTable } from './records.tsx'

import './App.css'

const addressAtom = atom(async () => await invoke<string>('get_address'))

function App() {
  useRowsUpdates()
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
    void navigator.clipboard.writeText(address)
    setCopiedOpen(true)

    if (copiedTimer.current) {
      clearTimeout(copiedTimer.current)
    }
    copiedTimer.current = setTimeout(() => {
      setCopiedOpen(false)
    }, 1200)
  }

  return (
    <main className="flex h-screen flex-col">
      <div className="flex h-12 items-center border-b px-4">
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
      </div>
      <div className="min-h-0 flex-1">
        <Suspense fallback={<span>loading...</span>}>
          <RecordsTable />
        </Suspense>
      </div>
    </main>
  )
}

export default App
