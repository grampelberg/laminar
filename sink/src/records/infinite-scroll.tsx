import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useEffect, useRef, type RefObject } from 'react'

import {
  isNearTopAtom,
  loadMoreRowsAtom,
  refreshRowsAtom,
  rowsStateAtom,
} from '@/db.tsx'

const NEAR_TOP_THRESHOLD_PX = 32
const NEAR_BOTTOM_THRESHOLD_PX = 64

export const RecordsInfiniteScroll = ({
  rowCount,
  scrollAreaRef,
}: {
  rowCount: number
  scrollAreaRef: RefObject<HTMLDivElement | null>
}) => {
  const { hasMore, isLoading, pendingNewRows } = useAtomValue(rowsStateAtom)
  const [isNearTop, setIsNearTop] = useAtom(isNearTopAtom)
  const refreshRows = useSetAtom(refreshRowsAtom)
  const loadMoreRows = useSetAtom(loadMoreRowsAtom)

  const getViewport = useCallback(
    () =>
      scrollAreaRef.current?.querySelector<HTMLDivElement>(
        "[data-slot='scroll-area-viewport']",
      ) ?? undefined,
    [scrollAreaRef],
  )

  const handleScroll = useCallback(
    (element: HTMLDivElement) => {
      setIsNearTop(element.scrollTop <= NEAR_TOP_THRESHOLD_PX)

      const distanceFromBottom =
        element.scrollHeight - (element.scrollTop + element.clientHeight)

      if (
        distanceFromBottom <= NEAR_BOTTOM_THRESHOLD_PX &&
        hasMore &&
        !isLoading
      ) {
        void loadMoreRows()
      }
    },
    [hasMore, isLoading, loadMoreRows, setIsNearTop],
  )

  const handleScrollRef = useRef(handleScroll)
  handleScrollRef.current = handleScroll

  useEffect(() => {
    const viewport = getViewport()
    if (!viewport) {
      return
    }

    setIsNearTop(viewport.scrollTop <= NEAR_TOP_THRESHOLD_PX)

    const onScroll = () => handleScrollRef.current(viewport)
    viewport.addEventListener('scroll', onScroll)
    return () => viewport.removeEventListener('scroll', onScroll)
  }, [getViewport, setIsNearTop])

  useEffect(() => {
    if (!isNearTop || pendingNewRows === 0) {
      return
    }

    void refreshRows()
  }, [isNearTop, pendingNewRows, refreshRows])

  useEffect(() => {
    const viewport = getViewport()
    if (!viewport) {
      return
    }

    handleScroll(viewport)
  }, [getViewport, handleScroll, hasMore, isLoading, rowCount])

  return undefined
}
