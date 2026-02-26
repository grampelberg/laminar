import React from 'react'
import ReactDOM from 'react-dom/client'

import App from './app.tsx'
import { ErrorBoundary } from './error-boundary.tsx'

const RootMode =
  import.meta.env.VITE_STRICT_MODE === 'false' ? React.Fragment : React.StrictMode

ReactDOM.createRoot(
  globalThis.document.getElementById('root') as HTMLElement,
).render(
  <RootMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </RootMode>,
)
