//import './wdyr'

import React from 'react'
import ReactDOM from 'react-dom/client'

import App from './app.tsx'
import { ErrorBoundary } from './error-boundary.tsx'

ReactDOM.createRoot(
  globalThis.document.getElementById('root') as HTMLElement,
).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
