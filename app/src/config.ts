import { invoke } from '@tauri-apps/api/core'
import { atom, type SetStateAction, type WritableAtom } from 'jotai'
import { focusAtom } from 'jotai-optics'
import { atomWithRefresh, unwrap } from 'jotai/utils'

import { convertAtom } from '@/atom'
import { daysToHours, hoursToDays } from '@/utils'

const DEFAULT_RETENTION_DAYS = 7

export interface Config {
  layer: {
    remote?: string | null
    display_name?: string | null
  }
  reader: {
    key: unknown
  }
  settings: {
    retention: number
  }
}

export const DEFAULT_CONFIG: Config = {
  layer: {
    remote: '',
    display_name: '',
  },
  reader: {
    key: 'None',
  },
  settings: {
    retention: daysToHours(DEFAULT_RETENTION_DAYS),
  },
}

const getConfigAtom = atomWithRefresh(
  async () => await invoke<Config>('get_config'),
)

export const configAtom = atom(
  get => get(getConfigAtom),
  async (get, set, val: SetStateAction<Config>) => {
    const next = await Promise.resolve(val)
    await invoke('set_config', {
      next:
        typeof next === 'function'
          ? await Promise.resolve(get(getConfigAtom)).then(prev => next(prev))
          : next,
    })

    set(getConfigAtom)
  },
)
configAtom.debugLabel = 'configAtom'

export const retentionAtom = convertAtom(
  focusAtom(configAtom as any, (lens: any) =>
    lens.prop('settings').prop('retention'),
  ) as any,
  hoursToDays,
  daysToHours,
)

export const displayNameAtom = unwrap(
  convertAtom(
    focusAtom(configAtom as any, (lens: any) =>
      lens.prop('layer').prop('display_name'),
    ) as any,
    val => val ?? '',
    val => (val === '' ? undefined : val),
  ),
  prev => prev ?? '',
) as unknown as WritableAtom<string, [SetStateAction<string>], Promise<void>>

export const remoteAtom = unwrap(
  convertAtom(
    focusAtom(configAtom as any, (lens: any) =>
      lens.prop('layer').prop('remote'),
    ) as any,
    val => val ?? '',
    val => (val === '' ? undefined : val),
  ),
  prev => prev ?? '',
) as unknown as WritableAtom<string, [SetStateAction<string>], Promise<void>>
