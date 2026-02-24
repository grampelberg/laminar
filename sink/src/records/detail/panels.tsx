import type { Selectable } from 'kysely'
import { useMemo } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import {
  oneDark,
  oneLight,
} from 'react-syntax-highlighter/dist/esm/styles/prism'

import { isDark } from '@/lib/utils.ts'
import type { Identity } from '@/types/db.ts'

import type { RecordRow } from '../data.tsx'

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

export const FieldTable = ({
  fields,
  emptyState = 'No data',
}: {
  fields: Record<string, unknown>
  emptyState?: string
}) => {
  const rows = useMemo(
    () =>
      Object.entries(fields).toSorted(([keyA], [keyB]) =>
        keyA.localeCompare(keyB),
      ),
    [fields],
  )

  if (rows.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        {emptyState}
      </div>
    )
  }

  return (
    <dl className="divide-y rounded-md border">
      {rows.map(([key, value]) => (
        <div className="space-y-1 px-3 py-2" key={key}>
          <dt className="font-mono text-xs text-muted-foreground">{key}</dt>
          <dd className="wrap-break-word whitespace-normal">
            {renderValue(value)}
          </dd>
        </div>
      ))}
    </dl>
  )
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

export const JSONTab = ({ fields }: { fields: Record<string, unknown> }) => (
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

const OMITTED_RAW_KEYS = new Set([
  'fields_json',
  'id',
  'identity_pk',
  'message',
])

export const MetaTab = ({
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
        <h3 className="text-sm font-medium text-muted-foreground">Row</h3>
        <FieldTable fields={rawTable} />
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">Source</h3>
        <FieldTable fields={sourceTable} />
      </div>
    </div>
  )
}
