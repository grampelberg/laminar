import { type ClassValue, clsx } from 'clsx'
import { memo as reactMemo, type ReactElement } from 'react'
import { extendTailwindMerge } from 'tailwind-merge'

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': ['text-xxs'],
    },
  },
})

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))
export const px = (n: number) => `${n}px`

export const isDark = globalThis.matchMedia(
  '(prefers-color-scheme: dark)',
).matches

export const memo = <Props>(
  component: (props: Props) => ReactElement,
  areEqual?: (prev: Readonly<Props>, next: Readonly<Props>) => boolean,
) =>
  reactMemo(component as any, areEqual as any) as (props: Props) => ReactElement
