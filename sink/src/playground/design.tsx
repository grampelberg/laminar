import { Route } from 'wouter'

import { AddressButton } from '@/address'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { SampleTable } from '@/playground/sample-table.tsx'
import { RecordsTable } from '@/records/table.tsx'

export const DesignPlayground = () => (
  <>
    <Route path="/">
      {' '}
      <div className="sticky top-0 z-10 border-b bg-background/50 py-4 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between">
          <h1 className="text-base font-bold">Design Playground</h1>
          <div className="flex items-center gap-2">
            <AddressButton />
            <AnimatedThemeToggler />
          </div>
        </div>
      </div>
      <div className="container mx-auto py-8">
        <RecordsTable />
      </div>
    </Route>
    <Route path="/table">
      <SampleTable />
    </Route>
  </>
)
