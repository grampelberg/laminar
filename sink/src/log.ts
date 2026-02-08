import { debug } from 'debug'

export const log = (path: string) => {
  const modulePath =
    path
      .split('src/')
      .at(-1)
      ?.replace(/\.[^.]+$/, '')
      .replaceAll('/', '::') ?? ''

  return debug(`inspector::${modulePath}`)
}
