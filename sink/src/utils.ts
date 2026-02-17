import { debug } from 'debug'

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
