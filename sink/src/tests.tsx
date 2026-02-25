import { mockIPC } from '@tauri-apps/api/mocks'
import { expect, onTestFinished, vi } from 'vitest'

import { DEFAULT_CONFIG } from '@/config.ts'
import { DEFAULT_STATE } from '@/state.ts'
import { getLogger } from '@/utils'

const logger = getLogger('test-helpers')

export const INVOKE_SELECT = 'plugin:sql|select'
const INVOKE_LOAD = 'plugin:sql|load'
const INVOKE_CONFIG = 'get_config'
const INVOKE_STATE = 'get_state'
const INVOKE_STATUS = 'get_status'
const INVOKE_SERIES = 'get_series'

const TO_MS = 1000
const UNHANDLED_SETTLE_DELAY_MS = 10

export const nextTick = () =>
  new Promise(resolve => globalThis.setTimeout(resolve, 1))

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
  state?: unknown
  load?: unknown
  select?: unknown
  status?: unknown
  series?: unknown
}

export const dispatchInvoke =
  (stub: InvokeStub = {}) =>
  (cmd: string, args: unknown) => {
    logger('called invoke', cmd, args)

    switch (cmd) {
      case INVOKE_LOAD: {
        return stub.load ? resolve(stub.load, cmd, args) : []
      }
      case INVOKE_SELECT: {
        return stub.select ? resolve(stub.select, cmd, args) : []
      }
      case INVOKE_CONFIG: {
        return stub.config ? resolve(stub.config, cmd, args) : DEFAULT_CONFIG
      }
      case INVOKE_STATE: {
        return stub.state ? resolve(stub.state, cmd, args) : DEFAULT_STATE
      }
      case INVOKE_STATUS: {
        return stub.status ? resolve(stub.status, cmd, args) : { dbSize: 0 }
      }
      case INVOKE_SERIES: {
        return stub.series
          ? resolve(stub.series, cmd, args)
          : { points: [], stats: { rate: undefined, total: 0 } }
      }
      default: {
        throw new Error(`unhandled invoke: ${cmd}. Add to dispatchInvoke`)
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

export const unhandled = () => {
  const onUnhandled = vi.fn()
  globalThis.window.addEventListener('unhandledrejection', onUnhandled)

  onTestFinished(() => {
    globalThis.window.removeEventListener('unhandledrejection', onUnhandled)
  })

  return async () => {
    await new Promise(resolve =>
      globalThis.setTimeout(resolve, UNHANDLED_SETTLE_DELAY_MS),
    )
    expect(onUnhandled).not.toHaveBeenCalled()
  }
}
