import { clearMocks } from '@tauri-apps/api/mocks'
import { renderHook } from '@testing-library/react'
import { useAtom } from 'jotai'
import { describe, expect, it, beforeEach } from 'vitest'

import { stateAtom } from '@/records/data.tsx'
import { getCalls, INVOKE_SELECT, mockInvoke, nextTick } from '@/tests'

// Tests:
describe('records/data', () => {
  beforeEach(() => {
    clearMocks()
  })

  it('should only call select once on mount', async () => {
    const spy = mockInvoke()

    renderHook(() => useAtom(stateAtom))

    await nextTick()

    expect(getCalls(spy, INVOKE_SELECT)).toHaveLength(1)
  })
})
