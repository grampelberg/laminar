import { type UnlistenFn, listen } from '@tauri-apps/api/event'
import { useSetAtom } from 'jotai'
import { useEffect } from 'react'

import { refreshRowsAtom } from '@/db.tsx'
import { useMock } from '@/mock.ts'

let stop: UnlistenFn | undefined = undefined

export const useRowsUpdates = () => {
  const refreshRows = useSetAtom(refreshRowsAtom)

  useEffect(() => {
    if (stop) {
      return
    }
    ;(async () => {
      if (useMock) {
        return
      }

      stop = await listen('got_envelope', () => refreshRows())
    })()

    return () => {
      stop?.()
      stop = undefined
    }
  }, [refreshRows])
}
