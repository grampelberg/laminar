import { useAtom, useAtomValue } from 'jotai'
import type { Selectable } from 'kysely'
import { VisuallyHidden } from 'radix-ui'
import { useEffect, useMemo, useState, useCallback } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import {
  oneDark,
  oneLight,
} from 'react-syntax-highlighter/dist/esm/styles/prism'

import { LevelBadge } from '@/components/level-badge.tsx'
import { Timestamp } from '@/components/timestamp.tsx'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet.tsx'
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@/components/ui/table.tsx'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs.tsx'
import { isDark } from '@/lib/utils.ts'
import type { Identity } from '@/types/db.ts'

import { identityAtom, selectedAtom, type RecordRow } from './data.tsx'

const renderValue = (value: unknown) => {
  if (value === undefined) {
    return 'undefined'
  }
  if (value === null) {
    return 'null'
  }
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return JSON.stringify(value)
}

const syntaxTheme = {
  ...(isDark ? oneDark : oneLight),
  'pre[class*="language-"]': {
    ...(isDark ? oneDark : oneLight)['pre[class*="language-"]'],
    background: 'var(--background)',
    color: 'var(--foreground)',
  },
  'code[class*="language-"]': {
    ...(isDark ? oneDark : oneLight)['code[class*="language-"]'],
    background: 'transparent',
    color: 'inherit',
  },
}

const OMITTED_RAW_KEYS = new Set([
  'fields_json',
  'id',
  'identity_pk',
  'message',
])

const FieldTable = ({ fields }: { fields: Record<string, unknown> }) => {
  const rows = useMemo(
    () =>
      Object.entries(fields).toSorted(([keyA], [keyB]) =>
        keyA.localeCompare(keyB),
      ),
    [fields],
  )

  return (
    <Table>
      <TableBody>
        {rows.map(([key, value]) => (
          <TableRow key={key}>
            <TableCell className="w-56 max-w-56 min-w-56 font-mono text-xs">
              {key}
            </TableCell>
            <TableCell className="max-w-lg wrap-break-word whitespace-normal">
              {renderValue(value)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

const JSONTab = ({ fields }: { fields: Record<string, unknown> }) => (
  <div className="max-w-full overflow-x-auto rounded-md border">
    <SyntaxHighlighter
      customStyle={{
        background: 'var(--background)',
        borderRadius: '0.375rem',
        fontSize: '0.75rem',
        margin: 0,
        minWidth: 'max-content',
      }}
      language="json"
      lineNumberStyle={{
        background: 'transparent',
        color: 'var(--muted-foreground)',
      }}
      lineProps={{ style: { background: 'transparent' } }}
      showLineNumbers
      style={syntaxTheme}
      wrapLines
    >
      {JSON.stringify(fields, undefined, 2)}
    </SyntaxHighlighter>
  </div>
)

const MetaTab = ({
  row,
  identity,
}: {
  row: RecordRow
  identity: Selectable<Identity>
}) => {
  const sourceTable = Object.fromEntries(Object.entries(identity))
  const rawTable = Object.fromEntries(
    Object.entries(row).filter(([key]) => !OMITTED_RAW_KEYS.has(key)),
  )

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">Source</h3>
        <FieldTable fields={sourceTable} />
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">Row</h3>
        <FieldTable fields={rawTable} />
      </div>
    </div>
  )
}

export const DetailInner = ({
  row,
  identity,
  onDismiss,
  open,
}: {
  row: RecordRow
  identity: Selectable<Identity>
  onDismiss: () => void
  open: boolean
}) => {
  const fields = useMemo(() => JSON.parse(row.fields_json || '{}'), [row])

  return (
    <Sheet
      modal={false}
      onOpenChange={open => {
        if (!open) {
          onDismiss()
        }
      }}
      open={open}
    >
      <SheetContent
        className="sm:max-w-3xl"
        onInteractOutside={event => {
          const target = event.target as HTMLElement | null
          if (target?.closest('[data-slot="table-row"]')) {
            event.preventDefault()
          }
        }}
        showOverlay={false}
        side="right"
        onOpenAutoFocus={event => {
          event.preventDefault()
        }}
      >
        <SheetHeader>
          <SheetTitle>
            <Timestamp format="long" ms={row.ts_ms} />
          </SheetTitle>

          <div className="grid grid-cols-[100px_auto] items-center gap-3 text-sm text-muted-foreground">
            <LevelBadge className="w-15" level={row.level} />
            <span className="truncate font-mono text-xs">{row.target}</span>
          </div>

          <VisuallyHidden.Root asChild>
            <SheetDescription>View selected record details.</SheetDescription>
          </VisuallyHidden.Root>
        </SheetHeader>
        <div className="flex h-full min-h-0 flex-col px-4 pb-4">
          <Tabs className="min-h-0 flex-1" defaultValue="fields">
            <TabsList
              className="sticky top-0 z-10 border-b bg-background"
              variant="line"
            >
              <TabsTrigger value="fields">Fields</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
              <TabsTrigger value="raw">Metadata</TabsTrigger>
            </TabsList>
            <TabsContent className="min-h-0 overflow-auto" value="fields">
              <FieldTable fields={fields} />
            </TabsContent>
            <TabsContent className="min-h-0 overflow-auto" value="json">
              <JSONTab fields={fields} />
            </TabsContent>
            <TabsContent className="min-h-0 overflow-auto" value="raw">
              <MetaTab row={row} identity={identity} />
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export const RecordDetail = () => {
  const identity = useAtomValue(identityAtom)
  const [row, setSelected] = useAtom(selectedAtom)
  const [detail, setDetail] = useState<
    | {
        identity: Selectable<Identity>
        row: RecordRow
      }
    | undefined
  >(undefined)
  const open = Boolean(row)

  useEffect(() => {
    if (!row || !identity) {
      return
    }

    setDetail({
      identity,
      row,
    })
  }, [identity, row])

  const onDismiss = useCallback(() => {
    setSelected(undefined)
  }, [setSelected])

  return detail && <DetailInner {...detail} onDismiss={onDismiss} open={open} />
}
