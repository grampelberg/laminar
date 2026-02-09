import { atom, useAtomValue } from 'jotai'

import type { RecordRow } from '@/db.tsx'
import { cn } from '@/lib/utils'
import { log } from '@/log.ts'
import { Fields } from '@/records/fields.tsx'
import { RecordsTable } from '@/records/table.tsx'

const logger = log(import.meta.url)

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
      <RecordsTable />

      {selected && <Fields />}
    </div>
  )
}
