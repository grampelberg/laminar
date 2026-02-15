import { mockIPC } from '@tauri-apps/api/mocks'
import { vi } from 'vitest'

import { getLogger } from '@/utils'

const logger = getLogger('test-helpers')

export const INVOKE_SELECT = 'plugin:sql|select'
const INVOKE_CONFIG = 'get_config'

const TO_MS = 1000

export const nextTick = () =>
  new Promise(resolve => globalThis.setTimeout(resolve, 0))

export const parseTime = (value: string) => {
  const num = Number.parseFloat(value)
  return value.trim().endsWith('ms') ? num : num * TO_MS
}

type Resolvable<TValue, Args extends unknown[] = []> =
  | TValue
  | ((...args: Args) => TValue)

const resolve = <TValue, Args extends unknown[] = []>(
  value: Resolvable<TValue, Args>,
  ...args: Args
): TValue =>
  typeof value === 'function'
    ? (value as (...args: Args) => TValue)(...args)
    : value

interface InvokeStub {
  config?: unknown
  select?: unknown
}

export const dispatchInvoke =
  (stub: InvokeStub = {}) =>
  (cmd: string, args: unknown) => {
  logger('called invoke', cmd, args)

  switch (cmd) {
    case INVOKE_SELECT: {
      return stub.select ? resolve(stub.select, cmd, args) : []
    }
    case INVOKE_CONFIG: {
      return stub.config
        ? resolve(stub.config, cmd, args)
        : {
            address: '',
            db: {
              path: '',
              url: '',
            },
          }
    }
  }
  }

export const mockInvoke = (stub: InvokeStub = {}) => {
  mockIPC(dispatchInvoke(stub), { shouldMockEvents: true })
  const tauri = globalThis as typeof globalThis & {
    __TAURI_INTERNALS__: {
      invoke: (...args: unknown[]) => unknown
    }
  }

  return vi.spyOn(tauri.__TAURI_INTERNALS__, 'invoke')
}

export const getCalls = (spy: ReturnType<typeof vi.spyOn>, name: string) =>
  spy.mock.calls.filter((call: unknown[]) => call[0] === name)
