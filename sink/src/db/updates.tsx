import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { useSetAtom } from 'jotai'
import { useEffect } from 'react'

import { refreshRowsAtom } from '../db.tsx'

let stopRowsUpdates: UnlistenFn | null = null
let rowsUpdatesSubscribers = 0

const startRowsUpdates = async (
  refreshRows: () => Promise<void>,
) => {
  if (stopRowsUpdates) {
    return
  }

  await refreshRows()
  stopRowsUpdates = await listen('got_envelope', () => refreshRows())
}

const stopRowsUpdatesIfUnused = () => {
  if (rowsUpdatesSubscribers !== 0 || !stopRowsUpdates) {
    return
  }

  stopRowsUpdates()
  stopRowsUpdates = null
}

export const useRowsUpdates = () => {
  const refreshRows = useSetAtom(refreshRowsAtom)

  useEffect(() => {
    rowsUpdatesSubscribers += 1
    void startRowsUpdates(refreshRows)

    return () => {
      rowsUpdatesSubscribers -= 1
      stopRowsUpdatesIfUnused()
    }
  }, [refreshRows])
}
