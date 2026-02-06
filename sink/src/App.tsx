import { Suspense } from 'react'

import { useRowsUpdates } from './db/updates.tsx'
import { RecordsTable } from './records.tsx'

import './App.css'

function App() {
  useRowsUpdates()

  return (
    <main className="flex h-screen">
      <Suspense fallback={<span>loading...</span>}>
        <RecordsTable />
      </Suspense>
    </main>
  )
}

export default App
