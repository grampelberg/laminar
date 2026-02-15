import { atomEffect } from 'jotai-effect'
import { atomWithRefresh } from 'jotai/utils'

import { dbAtom } from '@/db'
import { streamAtom } from '@/stream.tsx'
import { getLogger } from '@/utils'

import byName from './by_name.sql?raw'

const logger = getLogger(import.meta.url)

export interface ByNameRow {
  current_connections: number
  last_seen: number
  name: string
  total_clients: number
}

export interface ByNameResult {
  rows: ByNameRow[]
  totalConnected: number
}

export const byNameAtom = atomWithRefresh(async get => {
  const db = await get(dbAtom)
  const [val] = await db.select<{ payload?: string }[]>(byName)
  if (!val?.payload) {
    return { rows: [], totalConnected: 0 } satisfies ByNameResult
  }

  return JSON.parse(val.payload) as ByNameResult
})

export const statusUpdateAtom = atomEffect((get, set) => {
  void (async () => {
    const ev = get(streamAtom)
    const event = (ev as { event?: unknown } | undefined)?.event
    const isUpdate = event === 'Connect' || event === 'Disconnect'

    if (!isUpdate) {
      return
    }

    set(byNameAtom)
    logger('refresh by_name', event)
  })()
})
