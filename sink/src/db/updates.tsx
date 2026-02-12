import { type UnlistenFn, listen } from '@tauri-apps/api/event'
import { useSetAtom } from 'jotai'
import { useEffect } from 'react'

import { newRowsAtom } from '@/db.tsx'
import { useMock } from '@/mock.ts'

let stop: UnlistenFn | undefined = undefined
type ResponseEventKind = 'Connect' | 'Disconnect' | 'Data'

export const useRowsUpdates = () => {
  const refreshRows = useSetAtom(newRowsAtom)

  useEffect(() => {
    if (stop) {
      return
    }

    void refreshRows()

    ;(async () => {
      if (useMock) {
        return
      }

      stop = await listen<ResponseEventKind>('got_envelope', event => {
        if (event.payload === 'Data') {
          void refreshRows()
        }
      })
    })()

    return () => {
      stop?.()
      stop = undefined
    }
  }, [refreshRows])
}
