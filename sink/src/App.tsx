import { Route, Switch } from 'wouter'

import { Toaster } from '@/components/ui/sonner.tsx'
import { DevCommands } from '@/dev.tsx'
import { Native } from '@/native.tsx'
import { DesignPlayground } from '@/playground/design.tsx'

import './App.css'

function App() {
  return (
    <main className="flex h-screen flex-col">
      <Switch>
        <Route component={DesignPlayground} path="/design" />
        <Route component={Native} />
      </Switch>
      <DevCommands />
      <Toaster />
    </main>
  )
}

export default App
