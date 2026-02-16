import { type Atom, atom, Provider, useAtomValue, createStore } from 'jotai'
import { useAtomsSnapshot } from 'jotai-devtools'
import { type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderHook } from 'vitest-browser-react'

import { getLogger } from '@/utils.ts'

import { __test as fixtureTest } from './fixtures.tsx'
const { exportFixture } = fixtureTest

const logger = getLogger(import.meta.url)

const getFixture = async (atoms: Atom<unknown>[]) => {
  const store = createStore()

  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  )

  const {
    result: {
      current: { values: snapshot },
    },
  } = await renderHook(
    () => {
      atoms.map(atomConfig => useAtomValue(atomConfig))
      return useAtomsSnapshot({ store })
    },
    { wrapper },
  )

  vi.spyOn(globalThis.navigator.clipboard, 'writeText').mockResolvedValue(
    undefined,
  )

  const fixture = await exportFixture(snapshot)

  return {
    store,
    fixture,
  }
}

describe('Fixtures', () => {
  describe('Export', () => {
    it('works with primitive atoms', async () => {
      const anAtom = atom(10)

      const { fixture } = await getFixture([anAtom])

      expect(fixture).toContain('anAtom')
      expect(fixture).toContain('10')
    })

    it('handles undefined atoms', async () => {
      const undefinedAtom = atom(undefined)

      const { fixture } = await getFixture([undefinedAtom])

      expect(fixture).toContain('void 0')
    })

    it('works with derived atoms', async () => {
      const baseAtom = atom(10)
      const derivedAtom = atom(get => get(baseAtom) + 5)

      const { fixture } = await getFixture([baseAtom, derivedAtom])

      expect(fixture).toContain('baseAtom')
      expect(fixture).toContain('10')
      expect(fixture).toContain('derivedAtom')
      expect(fixture).toContain('15')
    })

    it('only exports public atoms', async () => {
      const publicAtom = atom(10)
      publicAtom.debugLabel = 'publicAtom'

      const privateAtom = atom(20)
      privateAtom.debugLabel = 'privateAtom'
      privateAtom.debugPrivate = true

      const { fixture } = await getFixture([publicAtom, privateAtom])

      expect(fixture).toContain('publicAtom')
      expect(fixture).not.toContain('privateAtom')
    })

    it('only exports data objects', async () => {
      const invalidAtom = atom({
        getValue: () => 10,
      })
      invalidAtom.debugLabel = 'invalidAtom'

      await expect(getFixture([invalidAtom])).rejects.toThrow(
        /invalidAtom does not appear to be POJO/,
      )
    })

    it('works with async atoms', async () => {
      const asyncAtom = atom(async () => await Promise.resolve(42))

      const { fixture } = await getFixture([asyncAtom])

      expect(fixture).toContain('asyncAtom')
      expect(fixture).toContain('42')
    })
  })
})
