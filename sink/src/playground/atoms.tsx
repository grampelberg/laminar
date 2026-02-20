import { atom } from 'jotai'
import { useAtomValue } from 'jotai/react'

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

export const LinkedAtoms = () => {
  const bVal = useAtomValue(baseAtom)
  const mVal = useAtomValue(middleAtom)
  const tVal = useAtomValue(topAtom)

  return (
    <ul>
      <li>Base: {bVal}</li>
      <li>Middle: {mVal}</li>
      <li>Top: {tVal}</li>
    </ul>
  )
}
