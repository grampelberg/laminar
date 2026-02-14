import { atom, useAtomValue } from 'jotai'

import { cn } from '@/lib/utils'
import { getLogger } from '@/utils.ts'
import { Controls } from '@/records/controls.tsx'
import type { RecordRow } from '@/records/data.tsx'
import { Fields } from '@/records/fields.tsx'
import { RecordsTable } from '@/records/table.tsx'

const logger = getLogger(import.meta.url)

export const selectedAtom = atom<RecordRow | undefined>(undefined)

export const Records = () => {
  const selected = useAtomValue(selectedAtom)

  return (
    <div
      className={cn(
        'grid gap-4 transition-[grid-template-columns] duration-200 ease-in-out',
        selected ? 'grid-cols-[3fr_1fr]' : 'grid-cols-[1fr_0fr]',
      )}
    >
      <div className="flex h-[calc(100vh-8rem)] min-w-0 flex-col rounded-md border">
        <Controls />
        <RecordsTable />
      </div>

      {selected && <Fields />}
    </div>
  )
}
