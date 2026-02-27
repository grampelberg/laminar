import { emit } from '@tauri-apps/api/event'
import { clearMocks } from '@tauri-apps/api/mocks'
import { describe, expect, it, beforeEach } from 'vitest'

import { __test as dataTest, positionAtom, stateAtom } from '@/records/data.tsx'
import {
  animationFor,
  renderTable,
  scrollTo,
  queryFixture,
} from '@/records/table.test-helpers'
import { __test as streamTest } from '@/stream.tsx'
import { nextTick, parseTime, getCalls, INVOKE_SELECT } from '@/tests'
import state from '~/fixtures/tests/records/table.ts'

const {
  atoms: {
    stateAtom: {
      value: { rows: fixtureRows },
    },
  },
} = state
const { ROWS_CHUNK_SIZE } = dataTest
const { EVENT_RECEIVED } = streamTest

describe('RecordsTable', () => {
  beforeEach(() => {
    clearMocks()
  })

  describe('live updates', () => {
    it('updates live', async () => {
      const middle = Math.floor(ROWS_CHUNK_SIZE / 2) + 1

      const { store, screen } = await renderTable(
        queryFixture([
          // These are setup to return a page of old results and then a newer set (as
          // per ordering) with overlap to verify that some have _added correctly.
          fixtureRows.slice(middle, ROWS_CHUNK_SIZE + 1),
          fixtureRows.slice(0, ROWS_CHUNK_SIZE - 1),
        ]),
      )

      emit(EVENT_RECEIVED, {
        event: {
          Data: {
            id: 1,
          },
        },
      })

      expect(screen.container.querySelector('tbody')).not.toHaveTextContent(
        'No Results',
      )

      // The live update should have tried to merge the old and new results. New
      // results that were *not* in the old ones are expected to have _added.
      await expect
        .poll(() => store.get(stateAtom).rows.at(0)?._added)
        .toBeDefined()

      expect(
        screen.container.querySelectorAll('.flash-row')?.length,
      ).toBeGreaterThan(1)

      const scroll = scrollTo(screen)
      scroll.toBottom()

      await expect
        .poll(() =>
          [
            ...screen.container.querySelectorAll(
              'tbody [data-slot="table-row"]',
            ),
          ].at(-1),
        )
        .not.toHaveClass('flash-row')
    })

    it('only updates at the top', async () => {
      const { store, screen, spy } = await renderTable(() =>
        fixtureRows.slice(0, ROWS_CHUNK_SIZE + 1),
      )

      const scroll = scrollTo(screen)
      scroll.toBottom()

      await expect
        .poll(() => store.get(positionAtom))
        .toMatchObject({ top: false })

      const previousRows = store.get(stateAtom).rows
      const previousSelectQueries = getCalls(spy, INVOKE_SELECT).length

      await emit(EVENT_RECEIVED, {
        event: {
          Data: {
            id: 1,
          },
        },
      })
      await nextTick()

      expect(store.get(stateAtom).rows).toStrictEqual(previousRows)
      expect(getCalls(spy, INVOKE_SELECT).length).toBe(previousSelectQueries)
    })

    it('maintains animation across updates', async () => {
      const middle = Math.floor(ROWS_CHUNK_SIZE / 2) + 1

      const { store, screen } = await renderTable(
        queryFixture([
          fixtureRows.slice(middle, ROWS_CHUNK_SIZE + 1),
          fixtureRows.slice(0, ROWS_CHUNK_SIZE - 1),
          fixtureRows.slice(0, ROWS_CHUNK_SIZE - 1),
        ]),
      )

      emit(EVENT_RECEIVED, {
        event: {
          Data: {
            id: 1,
          },
        },
      })

      await expect
        .poll(() => store.get(stateAtom).rows.at(0)?._added)
        .toBeDefined()

      const before = animationFor(screen, '.flash-row td:first-child')

      const scroll = scrollTo(screen)
      scroll.toBottom()

      // Wait a little bit before scrolling up to trigger the resume code.
      await new Promise(resolve => globalThis.setTimeout(resolve, 100))

      scroll.toTop()

      await expect
        .poll(() => screen.container.querySelector('.flash-row td:first-child'))
        .toBeInstanceOf(globalThis.Element)

      const after = animationFor(screen, '.flash-row td:first-child')

      expect(parseTime(after.delay)).toBeLessThan(0)
      expect(parseTime(after.delay)).toBeLessThan(parseTime(before.delay))
    })
  })
})
