import { atom, type Getter, type SetStateAction } from 'jotai'
import { RESET } from 'jotai/utils'

import { getLogger } from '@/utils'

const logger = getLogger(import.meta.url)

export const atomWithOwnedDefault = <Value,>(
  getDefault: (get: Getter) => Value,
) => {
  const EMPTY = Symbol()
  const inner = atom<Value | typeof EMPTY>(EMPTY)

  const outer = atom(
    get => {
      const val = get(inner)
      if (val !== EMPTY) {
        return val
      }
      return getDefault(get)
    },
    (get, set, val: SetStateAction<Value> | typeof RESET) => {
      if (val === RESET) {
        return set(inner, getDefault(get))
      }

      set(
        inner,
        typeof val === 'function'
          ? (val as (prev: Value) => Value)(get(outer))
          : val,
      )
    },
  )

  outer.onMount = set => {
    set(RESET)
  }

  if (import.meta.env?.MODE !== 'production') {
    outer.debugPrivate = true
    inner.debugPrivate = true
  }

  return outer
}
