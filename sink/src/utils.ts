import { debug } from 'debug'
import { useMemo } from 'react'

const HOURS_PER_DAY = 24

export const getLogger = (path: string) => {
  const modulePath =
    path
      .split('src/')
      .at(-1)
      ?.replace(/\.[^.]+$/, '')
      .replaceAll('/', '::') ?? ''

  return debug(`inspector::${modulePath}`)
}

export const daysToHours = (days: number) => days * HOURS_PER_DAY
export const hoursToDays = (hours: number) => hours / HOURS_PER_DAY

export const getCssVar = (name: string, fallback = '') => {
  if (typeof globalThis.document === 'undefined') {
    return fallback
  }

  const value = globalThis
    .getComputedStyle(globalThis.document.documentElement)
    .getPropertyValue(name)
    .trim()

  return value.length > 0 ? value : fallback
}

export const useCssVar = (name: string, fallback = '') =>
  useMemo(() => getCssVar(name, fallback), [fallback, name])
