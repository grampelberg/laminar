import { invoke } from '@tauri-apps/api/core'
import { atom } from 'jotai'

export interface State {
  address: string
  db: {
    path: string
    url: string
  }
}

export const DEFAULT_STATE: State = {
  address: '',
  db: {
    path: '',
    url: '',
  },
}

export const stateAtom = atom(async () => await invoke<State>('get_state'))
