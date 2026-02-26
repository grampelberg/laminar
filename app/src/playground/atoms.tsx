import { atom } from 'jotai'
import { useAtomValue } from 'jotai/react'

import { getLogger } from '@/utils'

const logger = getLogger(import.meta.url)

const STEP = 10

const baseAtom = atom(async _get => await Promise.resolve(STEP))
const middleAtom = atom(async get => {
  const val = await get(baseAtom)
  return val + STEP
})
const topAtom = atom(async get => {
  const val = await get(middleAtom)
  return val + STEP
})

const mountAtom = atom(0)
mountAtom.onMount = () => {
  logger('mounted')

  return () => {
    logger('unmounted')
  }
}

export const LinkedAtoms = () => {
  const bVal = useAtomValue(baseAtom)
  const mVal = useAtomValue(middleAtom)
  const tVal = useAtomValue(topAtom)

  return (
    <>
      <ul>
        <li>Base: {bVal}</li>
        <li>Middle: {mVal}</li>
        <li>Top: {tVal}</li>
      </ul>
      <One />
      <Two />
    </>
  )
}

const One = () => {
  const val = useAtomValue(mountAtom)
  return <div>One: {val}</div>
}

const Two = () => {
  const val = useAtomValue(mountAtom)
  return <div>Two: {val}</div>
}
