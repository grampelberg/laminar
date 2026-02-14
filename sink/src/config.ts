import { invoke } from '@tauri-apps/api/core'
import { atom } from 'jotai'

interface Config {
  address: string
  dbUrl: string
}

export const configAtom = atom(async () => await invoke<Config>('get_config'))
