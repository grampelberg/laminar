import { invoke } from '@tauri-apps/api/core'
import { atomEffect } from 'jotai-effect'
import { atomWithRefresh, unwrap } from 'jotai/utils'

import { dbAtom } from '@/db'
import { streamAtom } from '@/stream.tsx'

import sessionsQuery from './recent_sessions.sql?raw'

export interface SessionRow {
  current: number
  last_seen: number
  name: string
  total: number
}

export interface SessionsResult {
  rows: SessionRow[]
  total: number
}

export interface Status {
  dbSize: number
}

export const statusAtom = unwrap(
  atomWithRefresh(async () => await invoke<Status>('get_status')),
  prev =>
    prev ?? {
      dbSize: 0,
    },
)

export const sessionsAtom = atomWithRefresh(async get => {
  const db = await get(dbAtom)
  const [val] = await db.select<{ payload?: string }[]>(sessionsQuery)
  if (!val?.payload) {
    return { rows: [], total: 0 } satisfies SessionsResult
  }

  return JSON.parse(val.payload) as SessionsResult
})

export const statusUpdateAtom = atomEffect((get, set) => {
  void (async () => {
    const signal = get(streamAtom)
    const shouldUpdate = signal > 0

    if (!shouldUpdate) {
      return
    }

    set(sessionsAtom)
    set(statusAtom)
  })()
})
