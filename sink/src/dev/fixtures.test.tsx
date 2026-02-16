import { waitFor } from '@testing-library/react'
import { type Atom, atom, Provider, useAtomValue, createStore } from 'jotai'
import { type ReactElement, type ReactNode } from 'react'
import { describe, expect, it, afterEach, beforeEach } from 'vitest'
import { render as browserRender } from 'vitest-browser-react'

import { unhandled } from '@/tests.tsx'
import { getLogger } from '@/utils.ts'

import { __test as runtimeTest } from './fixtures/runtime.tsx'

const { ApplySelectedFixture } = runtimeTest

const logger = getLogger(import.meta.url)

const ShowAtom = ({ atom: atomConfig }: { atom: Atom<ReactNode> }) => {
  const val = useAtomValue(atomConfig)
  return <span>{val}</span>
}

const render = async (path: string, el: ReactElement) => {
  const store = createStore()

  const screen = await browserRender(
    <Provider store={store}>
      <ApplySelectedFixture path={path} />
      {el}
    </Provider>,
  )

  return {
    screen,
    store,
  }
}

describe('Fixtures', () => {
  let expectUnhandled: ReturnType<typeof unhandled> | undefined = undefined

  beforeEach(() => {
    expectUnhandled = unhandled()
  })

  afterEach(async () => {
    await expectUnhandled?.()
    expectUnhandled = undefined
  })

  it('can replace primitive atoms', async () => {
    const countAtom = atom(0)

    const { screen, store } = await render(
      '/fixtures/tests/fixtures/count.ts',
      <ShowAtom atom={countAtom} />,
    )

    await expect.poll(() => screen.baseElement.textContent.trim()).toBe('42')
    expect(store.get(countAtom)).toBe(42)
  })

  // This is a regression test for https://github.com/atomicool/jotai-devtools/issues/103
  it('works with dependent atoms', async () => {
    const baseAtom = atom(async _get => await Promise.resolve(10))
    const middleAtom = atom(async get => {
      const val = await get(baseAtom)
      return val + 10
    })
    const topAtom = atom(async get => {
      const val = await get(middleAtom)
      return val + 10
    })

    const All = () => {
      const base = useAtomValue(baseAtom)
      const middle = useAtomValue(middleAtom)
      const top = useAtomValue(topAtom)

      return (
        <span>
          {base} {middle} {top}
        </span>
      )
    }

    const { store } = await render(
      '/fixtures/tests/fixtures/wrapper.ts',
      <All />,
    )

    await waitFor(() => {
      expect(store.get(baseAtom)).toBe(42)
      expect(store.get(middleAtom)).toBe(1)
      expect(store.get(topAtom)).toBe(60)
    })
  })
})
