import { invoke } from '@tauri-apps/api/core'
import { atom } from 'jotai'

import { useMock } from '@/mock.ts'

interface Config {
  address: string
  dbUrl: string
}

export const configAtom = atom(
  useMock
    ? async () => ({ address: '', dbUrl: '' })
    : async () => await invoke<Config>('get_config'),
)
