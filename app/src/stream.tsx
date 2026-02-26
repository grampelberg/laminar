import { type UnlistenFn, listen } from '@tauri-apps/api/event'
import { atom } from 'jotai'
import { withAtomEffect } from 'jotai-effect'

const EVENT_RECEIVED = 'got_event'

export const __test = {
  EVENT_RECEIVED,
}

export const streamAtom = withAtomEffect(
  atom(0),
  (_get, set) => {
    let alive = true
    let stop: UnlistenFn | undefined = undefined
    ;(async () => {
      stop = await listen(EVENT_RECEIVED, () => {
        set(streamAtom, prev => prev + 1)
      })

      if (!alive) {
        stop?.()
      }
    })()

    return () => {
      alive = false

      stop?.()
    }
  },
)
