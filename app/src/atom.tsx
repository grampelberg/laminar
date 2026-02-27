import {
  type Atom,
  atom,
  type Getter,
  type SetStateAction,
  type WritableAtom,
} from 'jotai'
import { atomEffect } from 'jotai-effect'
import { RESET, atomWithRefresh, atomWithReset } from 'jotai/utils'

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

export const convertAtom = <Source, Converted>(
  source: WritableAtom<Source, [Source], void>,
  from: (val: Source) => Converted,
  to: (val: Converted) => Source,
) => {
  const getVal = (get: Getter) =>
    Promise.resolve(get(source)).then(val => from(val))

  const converter = atom(
    get => getVal(get),
    async (get, set, val: SetStateAction<Converted>) => {
      const prev = await getVal(get)
      const next =
        typeof val === 'function'
          ? (val as (prev: Converted) => Converted)(prev)
          : val
      set(source, to(next))
    },
  )

  if (import.meta.env?.MODE !== 'production') {
    converter.debugPrivate = true
  }

  return converter
}

export const atomWithPeriodicRefresh = <Value,>(
  read: () => Promise<Value> | Value,
  intervalMs: number,
) => {
  const refreshable = atomWithRefresh(read)

  refreshable.onMount = refresh => {
    const intervalId = globalThis.setInterval(() => {
      refresh()
    }, intervalMs)

    return () => {
      globalThis.clearInterval(intervalId)
    }
  }

  if (import.meta.env?.MODE !== 'production') {
    refreshable.debugPrivate = true
  }

  return refreshable
}

export const resettable = <Value,>(
  source: Atom<Value>,
  initial: Value,
): WritableAtom<Value, [SetStateAction<Value> | typeof RESET], void> => {
  const data = atomWithReset(initial)

  const update = atomEffect((get, set) => {
    set(data, get(source))
  })

  if (import.meta.env?.MODE !== 'production') {
    data.debugPrivate = true
    update.debugPrivate = true
  }

  return atom(
    get => {
      get(update)
      return get(data)
    },
    (_get, set, value) => {
      set(data, value)
    },
  )
}
