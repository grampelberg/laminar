import { clearMocks } from '@tauri-apps/api/mocks'
import { page } from '@vitest/browser/context'
import { createStore, Provider } from 'jotai'
import { beforeEach, describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'

import { Records } from '@/records.tsx'
import { mockInvoke } from '@/tests.tsx'
import { getLogger } from '@/utils.ts'
import state from '~/fixtures/tests/records/marker.ts'

const logger = getLogger(import.meta.url)

const {
  atoms: {
    'records.state': {
      value: { rows: fixtureRows },
    },
  },
} = state

describe('Records', () => {
  beforeEach(() => {
    clearMocks()
  })

  it('renders marker icon fully inside the records viewport', async () => {
    await page.viewport(700, 900)

    mockInvoke({
      select: (_cmd: string, args: unknown) => {
        const query = (args as { query?: string })?.query ?? ''

        if (query.includes('COUNT(*)')) {
          return [{ count: 0 }]
        }

        return fixtureRows
      },
    })

    const screen = await render(
      <Provider store={createStore()}>
        <div className="container mx-auto py-8">
          <Records />
        </div>
      </Provider>,
    )

    await expect
      .poll(
        () =>
          screen.container.querySelectorAll(
            '[aria-label^="Filter by marker_kind"]',
          ).length,
      )
      .toBeGreaterThanOrEqual(1)

    const elem = screen.container.querySelector(
      '[aria-label^="Filter by marker_kind"] > div',
    ) as HTMLElement | null

    expect(elem).toBeVisible()
    await expect.element(elem).toBeInViewport({ ratio: 1 })
  })
})
