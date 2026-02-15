import { invoke } from '@tauri-apps/api/core'
import { atom } from 'jotai'

interface Config {
  address: string
  db: {
    path: string
    url: string
  }
}

export const configAtom = atom(async () => await invoke<Config>('get_config'))
