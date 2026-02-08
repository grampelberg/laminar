import { Suspense } from 'react'

import { AddressButton } from '@/address.tsx'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler.tsx'
import { useRowsUpdates } from '@/db/updates.tsx'
import { RecordsTable } from '@/records.tsx'

export const Native = () => {
  useRowsUpdates()

  return (
    <div className="flex h-full flex-col">
      <div className="sticky top-0 z-10 border-b bg-background/50 py-4 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between">
          <h1 className="text-base font-bold">TBD</h1>
          <div className="flex items-center gap-2">
            <AddressButton />
            <AnimatedThemeToggler />
          </div>
        </div>
      </div>
      <div className="container mx-auto py-8">
        <Suspense fallback={<span>loading...</span>}>
          <RecordsTable />
        </Suspense>
      </div>
    </div>
  )
}
