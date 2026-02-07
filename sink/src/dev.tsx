import { BugIcon, FlaskConicalIcon } from 'lucide-react'
import { useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'

import { Button } from '@/components/ui/button.tsx'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command.tsx'
import { FixturesCommand } from '@/dev/fixtures.tsx'

export const DevCommands = () => {
  const [open, setOpen] = useState(false)

  useHotkeys(
    'meta+p,ctrl+p',
    event => {
      event.preventDefault()
      setOpen(current => !current)
    },
    { preventDefault: true },
  )

  return (
    <>
      <Button
        aria-label="Open developer commands"
        className="fixed bottom-4 left-4 z-50 size-10 rounded-full shadow-lg"
        onClick={() => setOpen(true)}
        size="icon"
        type="button"
        variant="secondary"
      >
        <BugIcon />
      </Button>
      <CommandDialog onOpenChange={setOpen} open={open}>
        <CommandInput placeholder="Run development command..." />
        <CommandList>
          <CommandEmpty>No dev commands found.</CommandEmpty>
          <FixturesCommand onDone={() => setOpen(false)} />
          <CommandGroup heading="Development">
            <CommandItem onSelect={() => setOpen(false)}>
              <FlaskConicalIcon />
              Close command palette
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
