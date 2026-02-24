import { AnimatePresence, motion } from 'framer-motion'
import type { Selectable } from 'kysely'
import { XIcon } from 'lucide-react'
import {
  Children,
  Fragment,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { Message } from '@/components/message.tsx'
import { Button } from '@/components/ui/button.tsx'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs.tsx'
import type { Identity } from '@/types/db.ts'

import type { RecordRow } from './data.tsx'
import { FieldTable, JSONTab, MetaTab } from './detail/panels'

const SWIPE_DURATION = 0.2
const SWIPE_OFFSET = 50
const INDICATOR_DURATION = 0.2

const contentSwap = {
  enter: (direction: number) => ({ opacity: 0, x: direction * SWIPE_OFFSET }),
  exit: (direction: number) => ({ opacity: 0, x: direction * -SWIPE_OFFSET }),
  visible: { opacity: 1, x: 0 },
}

interface DirectionItemProps {
  children: ReactNode
  value: string
}

type DirectionItemElement = ReactElement<DirectionItemProps>

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const flattenFields = (
  fields: Record<string, unknown>,
  prefix = '',
): Record<string, unknown> =>
  Object.entries(fields).reduce<Record<string, unknown>>(
    (acc, [key, value]) => {
      const path = prefix.length > 0 ? `${prefix}.${key}` : key

      if (isObjectRecord(value) && Object.keys(value).length >= 0) {
        Object.assign(acc, flattenFields(value, path))
        return acc
      }

      acc[path] = value
      return acc
    },
    {},
  )

const flattenChildren = (children: ReactNode): ReactNode[] =>
  Children.toArray(children).flatMap(child => {
    if (isValidElement(child) && child.type === Fragment) {
      return flattenChildren((child.props as { children: ReactNode }).children)
    }

    return [child]
  })

const useDirection = (key: string, children: ReactNode) => {
  const items = useMemo(
    () =>
      flattenChildren(children).filter(
        (item): item is DirectionItemElement =>
          isValidElement<DirectionItemProps>(item) &&
          typeof item.props.value === 'string',
      ),
    [children],
  )

  const next = items.findIndex(item => item.props.value === key)
  const element = next !== -1 ? items[next].props.children : undefined

  const prevRef = useRef(next)

  const direction = next >= prevRef.current ? 1 : -1

  useEffect(() => {
    prevRef.current = next
  }, [next])

  return {
    element,
    direction,
  }
}

const DirectionItem = ({ children }: DirectionItemProps) => children

const AnimateIndicator = () => (
  <motion.span
    className="absolute inset-x-2 -bottom-1.25 h-0.5 rounded-full bg-foreground"
    layoutId="detail-tabs-active-indicator"
    transition={{ duration: INDICATOR_DURATION }}
  />
)

export const RecordDetail = ({
  row,
  identity,
  onDismiss,
}: {
  row: RecordRow
  identity: Selectable<Identity>
  onDismiss: () => void
}) => {
  const [tab, setTab] = useState('fields')
  const fields = useMemo(() => JSON.parse(row.fields_json || '{}'), [row])
  const flattenedFields = useMemo(() => flattenFields(fields), [fields])

  const { element, direction } = useDirection(
    tab,
    <>
      <DirectionItem value="fields">
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              Message
            </h3>
            <div className="rounded-md border px-3 py-2">
              <Message text={row.message} variant="detail" />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              Fields
            </h3>
            <FieldTable emptyState="No fields" fields={flattenedFields} />
          </div>
        </div>
      </DirectionItem>
      <DirectionItem value="json">
        <JSONTab fields={fields} />
      </DirectionItem>
      <DirectionItem value="raw">
        <MetaTab row={row} identity={identity} />
      </DirectionItem>
    </>,
  )

  return (
    <div className="flex h-full min-h-0 w-full flex-col px-4 pb-4">
      <Tabs
        className="min-h-0 flex-1"
        onValueChange={(next: string) => setTab(next)}
        value={tab}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background">
          <TabsList variant="line">
            <TabsTrigger className="after:hidden" value="fields">
              Fields
              {tab === 'fields' && <AnimateIndicator />}
            </TabsTrigger>
            <TabsTrigger className="after:hidden" value="json">
              JSON
              {tab === 'json' && <AnimateIndicator />}
            </TabsTrigger>
            <TabsTrigger className="after:hidden" value="raw">
              Metadata
              {tab === 'raw' && <AnimateIndicator />}
            </TabsTrigger>
          </TabsList>
          <Button
            aria-label="Close details"
            className="mr-1 size-7"
            onClick={onDismiss}
            size="icon"
            type="button"
            variant="ghost"
          >
            <XIcon className="size-4" />
          </Button>
        </div>
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={tab}
              className="absolute inset-0 overflow-auto"
              custom={direction}
              variants={contentSwap}
              initial="enter"
              animate="visible"
              exit="exit"
              transition={{
                duration: SWIPE_DURATION,
              }}
            >
              {element}
            </motion.div>
          </AnimatePresence>
        </div>
      </Tabs>
    </div>
  )
}
