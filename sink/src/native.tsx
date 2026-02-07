import { Suspense } from 'react'

import { AddressButton } from '@/address.tsx'
import { useRowsUpdates } from '@/db/updates.tsx'
import { RecordsTable } from '@/records.tsx'

export const Native = () => {
  useRowsUpdates()

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 items-center border-b px-4">
        <AddressButton />
      </div>
      <div className="min-h-0 flex-1">
        <Suspense fallback={<span>loading...</span>}>
          <RecordsTable />
        </Suspense>
      </div>
    </div>
  )
}
