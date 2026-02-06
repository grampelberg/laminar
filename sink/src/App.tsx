import { Route, Switch } from 'wouter'

import { Native } from './native.tsx'
import { DesignPlayground } from './playground/design.tsx'

import './App.css'

function App() {
  return (
    <main className="flex h-screen flex-col">
      <Switch>
        <Route component={DesignPlayground} path="/design" />
        <Route component={Native} />
      </Switch>
    </main>
  )
}

export default App
