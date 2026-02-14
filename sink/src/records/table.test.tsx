import { simpleFaker } from '@faker-js/faker'
import { clearMocks } from '@tauri-apps/api/mocks'
import { describe, expect, it, beforeEach } from 'vitest'

import {
  __test as dataTest,
  filtersAtom,
  positionAtom,
  stateAtom,
} from '@/records/data.tsx'
import {
  queryFixture,
  renderTable,
  scrollTo,
} from '@/records/table.test-helpers'
import { getCalls, INVOKE_SELECT } from '@/tests'
import state from '~/fixtures/tests/records/table.ts'

const { ROWS_CHUNK_SIZE } = dataTest

// Tests:
// - Errors get bubbled up to users for a bad db + query
describe('RecordsTable', () => {
  beforeEach(() => {
    clearMocks()
  })

  it('can be empty', async () => {
    const { screen, spy } = await renderTable(() => [])

    const rows = screen.container.querySelectorAll('tbody tr')
    expect(rows.length).toBe(1)
    expect(screen.container.querySelector('tbody')).toHaveTextContent(
      'No Results',
    )

    expect(spy).toHaveBeenCalledWith(
      INVOKE_SELECT,
      expect.anything(),
      undefined,
    )
  })

  it('populates on mount', async () => {
    const { screen } = await renderTable(() =>
      state.stateAtom.value.rows.slice(0, ROWS_CHUNK_SIZE + 1),
    )

    const rows = screen.container.querySelectorAll('tbody tr')
    expect(rows.length).toBeGreaterThan(1)
    expect(rows.length).toBeLessThan(ROWS_CHUNK_SIZE)
  })

  it('loads more when scrolled', async () => {
    const { store, screen, spy } = await renderTable(() =>
      state.stateAtom.value.rows.slice(0, ROWS_CHUNK_SIZE + 1),
    )

    const scroll = scrollTo(screen)

    const initialSize = scroll.viewport.scrollHeight

    scroll.toBottom()

    await expect.poll(() => spy.mock.calls.length).toBeGreaterThanOrEqual(3)

    await expect
      .poll(() => store.get(stateAtom)?.rows.length)
      .toBe(ROWS_CHUNK_SIZE * 2)
    expect(scroll.viewport.scrollHeight).toBeGreaterThan(initialSize)
  })

  it("stops when there's no more", async () => {
    const { store, screen, spy } = await renderTable(() =>
      // If fewer than chunk + 1 are returned, it is assumed there's nothing else in the database to load.
      state.stateAtom.value.rows.slice(0, ROWS_CHUNK_SIZE - 1),
    )

    const scroll = scrollTo(screen)

    const initialSize = scroll.viewport.scrollHeight
    const rowCount = store.get(stateAtom)?.rows.length
    const selectQueries = getCalls(spy, INVOKE_SELECT).length

    scroll.toBottom()

    await expect
      .poll(() => store.get(positionAtom))
      .toStrictEqual({ top: false, bottom: true })

    expect(scroll.viewport.scrollHeight).toBe(initialSize)
    expect(store.get(stateAtom)?.rows.length).toBe(rowCount)
    expect(getCalls(spy, INVOKE_SELECT).length).toBe(selectQueries)
  })

  it('refreshes on filter change', async () => {
    const { store, screen, spy } = await renderTable(
      queryFixture([
        state.stateAtom.value.rows.slice(0, ROWS_CHUNK_SIZE + 1),
        [],
      ]),
    )

    expect(
      screen.container.querySelectorAll('tbody tr').length,
    ).toBeGreaterThan(1)

    const val = simpleFaker.number.int()

    store.set(filtersAtom, [{ column: 'level', value: val }])

    await expect
      .poll(() => screen.container.querySelector('tbody'))
      .toHaveTextContent('No Results')

    const last = spy.mock.calls.at(-1)
    const args = last?.[1] as { query?: string; values?: unknown[] } | undefined

    expect(args?.query).toContain('level')
    expect(args?.values).toContain(val)
  })
})
