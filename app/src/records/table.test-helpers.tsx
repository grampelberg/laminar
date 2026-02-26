import { createStore, Provider } from 'jotai'
import { expect } from 'vitest'
import { render, type RenderResult } from 'vitest-browser-react'

import { RecordsTable } from '@/records/table'
import { mockInvoke } from '@/tests'

export const renderTable = async (
  selectFn: (cmd: string, args: unknown) => unknown,
) => {
  const store = createStore()

  const spy = mockInvoke({ select: selectFn })

  const screen = await render(
    <Provider store={store}>
      <div className="flex h-screen flex-col">
        <RecordsTable />
      </div>
    </Provider>,
  )

  return {
    store,
    screen,
    spy,
  }
}

export const scrollTo = (screen: RenderResult) => {
  const viewport = screen.container.querySelector(
    '[data-slot="scroll-area-viewport"]',
  ) as HTMLElement

  return {
    viewport,
    toTop: () => {
      viewport.scrollTo({ top: 0 })
    },
    toBottom: () => {
      viewport.scrollTo({
        top: viewport.scrollHeight - viewport.clientHeight - 1,
      })
    },
    atBottom: () =>
      viewport.scrollTop === viewport.scrollHeight - viewport.clientHeight - 1,
  }
}

export const animationFor = (screen: RenderResult, selector: string) => {
  const el = screen.container.querySelector(selector)
  expect(el).toBeInstanceOf(globalThis.Element)
  if (!el) {
    throw new Error(`Could not find element for selector: ${selector}`)
  }

  const style = globalThis.getComputedStyle(el, '::before')

  return {
    name: style.animationName,
    duration: style.animationDuration,
    delay: style.animationDelay,
  }
}

export const queryFixture = <TValue,>(results: TValue[]) => () => {
    const val = results.shift()

    if (!val) {
      throw new Error('no more results')
    }
    return val
  }
