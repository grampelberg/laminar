import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, type RenderResult } from 'vitest-browser-react'

import { Native } from './native'

describe('Native', () => {
  // This explicitly tests that native loads without any errors in the browser
  // (to maintain the `bun dev` workflow). Make sure you don't mock IPC here.
  it('renders', async () => {
    await render(
      <main className="flex h-screen flex-col">
        <Native />
      </main>,
    )
  })
})
