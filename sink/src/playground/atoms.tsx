import { atom } from 'jotai'
import { useAtomValue } from 'jotai/react'
import { atomWithRefresh } from 'jotai/utils'

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

const refreshAtom = atomWithRefresh(get => get(baseAtom))
refreshAtom.debugLabel = 'refreshAtom'

export const LinkedAtoms = () => {
  const bVal = useAtomValue(baseAtom)
  const mVal = useAtomValue(middleAtom)
  const tVal = useAtomValue(topAtom)

  const refVal = useAtomValue(refreshAtom)

  return (
    <ul>
      <li>Base: {bVal}</li>
      <li>Middle: {mVal}</li>
      <li>Top: {tVal}</li>
      <li>Refresh: {refVal}</li>
    </ul>
  )
}
