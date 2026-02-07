import { DevTools } from 'jotai-devtools'
import { Route, Switch } from 'wouter'

import { Native } from './native.tsx'
import { DesignPlayground } from './playground/design.tsx'

import 'jotai-devtools/styles.css'
import './App.css'

function App() {
  return (
    <main className="flex h-screen flex-col">
      {/*<DevTools />*/}
      <Switch>
        <Route component={DesignPlayground} path="/design" />
        <Route component={Native} />
      </Switch>
    </main>
  )
}

export default App
