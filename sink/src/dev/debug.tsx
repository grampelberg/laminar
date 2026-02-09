import { CircleOffIcon, Settings2Icon } from 'lucide-react'
import { useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'

import { Button } from '@/components/ui/button.tsx'
import { CommandGroup, CommandItem } from '@/components/ui/command.tsx'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.tsx'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input.tsx'

const DEBUG_KEY = 'debug'

export const DebugCommand = ({ onDone }: { onDone?: () => void }) => {
  const [dlgOpen, setDlgOpen] = useState(false)
  const [inp, setInput] = useState('inspector::*')

  useHotkeys(
    'enter',
    event => {
      event.preventDefault()
      submitNamespace()
    },
    { preventDefault: true },
  )

  const disableLogDebug = () => {
    globalThis.localStorage.removeItem(DEBUG_KEY)
    onDone?.()
  }

  const openCustomDialog = () => {
    setInput(globalThis.localStorage.getItem(DEBUG_KEY) ?? 'inspector::*')
    setDlgOpen(true)
  }

  const submitNamespace = () => {
    globalThis.localStorage.setItem(DEBUG_KEY, inp.trim())
    setDlgOpen(false)
    onDone?.()
  }

  return (
    <>
      <CommandGroup heading="Logging">
        <CommandItem onSelect={openCustomDialog}>
          <Settings2Icon />
          Enable debug logs
        </CommandItem>
        <CommandItem onSelect={disableLogDebug}>
          <CircleOffIcon />
          Disable debug logs
        </CommandItem>
      </CommandGroup>
      <Dialog onOpenChange={setDlgOpen} open={dlgOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set debug namespace</DialogTitle>
            <DialogDescription>
              Example: inspector::* or records::*
            </DialogDescription>
          </DialogHeader>
          <Field>
            {/* I have no idea why, but Input is not propagating enter.  */}
            <Input
              onKeyDown={key => key.code === 'Enter' && submitNamespace()}
              onChange={event => {
                setInput(event.target.value)
              }}
              placeholder="inspector::*"
              value={inp}
            />
          </Field>
          <DialogFooter>
            <Button
              onClick={() => setDlgOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button onClick={submitNamespace} type="submit">
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
