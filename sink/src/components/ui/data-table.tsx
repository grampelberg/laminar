import {
  flexRender,
  type Cell as TCell,
  type Header as THead,
  type Row as TRow,
  type Table as TTable,
  type RowData,
} from '@tanstack/react-table'
import {
  type ReactVirtualizerOptions,
  type Virtualizer,
  useVirtualizer,
} from '@tanstack/react-virtual'
import {
  type CSSProperties,
  type ReactElement,
  useEffect,
  useMemo,
  useRef,
} from 'react'

import {
  Table,
  TableBody,
  TableCell as UITableCell,
  TableHead as UITableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.tsx'
import { cn, px, memo } from '@/lib/utils.ts'

import { ScrollArea } from './scroll-area'

const DEFAULT_ROW_HEIGHT = 40

interface ColumnMeta {
  cellClassName?: string
  headerClassName?: string
}

export interface Viewport {
  first: number
  last: number
}

type RowPropsFn<Data extends RowData> = (
  row: TRow<Data>,
) => React.ComponentProps<'tr'>

const HCell = <Data extends RowData, Value = unknown>({
  node,
}: {
  node: THead<Data, Value>
}) => {
  const meta = (node.column.columnDef.meta || {}) as ColumnMeta

  return (
    <UITableHead
      className={cn(
        'group relative [&:last-child>div]:hidden',
        meta.headerClassName,
      )}
      style={{
        width: `var(--col-${node.column.id}-size)`,
      }}
    >
      {!node.isPlaceholder &&
        flexRender(node.column.columnDef.header, node.getContext())}
      {node.column.getCanResize() && (
        <div
          onMouseDown={node.getResizeHandler()}
          onTouchStart={node.getResizeHandler()}
          className={cn(
            'absolute top-0 right-0 h-full w-1.5 cursor-col-resize',
            'touch-none select-none',
            'group-hover:bg-foreground/40 active:bg-foreground/40',
          )}
        />
      )}
    </UITableHead>
  )
}

const BCell = <Data extends RowData, Value = unknown>({
  node,
}: {
  node: TCell<Data, Value>
}) => {
  const meta = (node.column.columnDef.meta || {}) as ColumnMeta

  return (
    <UITableCell className={meta.cellClassName}>
      {flexRender(node.column.columnDef.cell, node.getContext())}
    </UITableCell>
  )
}

const Empty = ({ colSpan }: { colSpan: number }) => (
  <TableRow>
    <UITableCell colSpan={colSpan} className="h-h-24 text-center">
      No Results
    </UITableCell>
  </TableRow>
)

interface BodyProps<Data extends RowData> {
  rows: TRow<Data>[]
  rowProps?: RowPropsFn<Data>
  virtualizer: Virtualizer<HTMLDivElement, Element>
}

const Body = <Data extends RowData>({
  rows,
  rowProps,
  virtualizer,
}: BodyProps<Data>) =>
  virtualizer.getVirtualItems().map(item => {
    const row = rows[item.index]

    return (
      <TableRow
        key={row.id}
        style={{
          height: item.size,
        }}
        {...rowProps?.(row)}
      >
        {row.getVisibleCells().map(cell => (
          <BCell key={cell.id} node={cell} />
        ))}
      </TableRow>
    )
  })

const MemoBody = memo(
  ({ viewport: _viewport, ...props }) => <Body {...props} />,
  (prev, next) => prev.viewport === next.viewport && prev.rows === next.rows,
) as <Data extends RowData>(
  props: BodyProps<Data> & { viewport: string },
) => ReactElement

const getPosition = (
  virtual: Virtualizer<HTMLDivElement, Element>,
) => {
  const items = virtual.getVirtualItems()
  const first = items[0]?.index ?? 0
  const last = items.at(-1)?.index ?? 0

  return {
    top: items[0]?.start ?? 0,
    bottom: virtual.getTotalSize() - (items.at(-1)?.end ?? 0),
    first,
    last,
    key: `${first}:${last}:${items.length}`,
  }
}

export interface DataTableProps<Data extends RowData> {
  table: TTable<Data>
  fullWidth?: boolean
  rowProps?: RowPropsFn<Data>
  virtualOpts?: Partial<ReactVirtualizerOptions<HTMLDivElement, Element>>
  onScroll: (viewport: Viewport) => void
}

export const DataTable = <Data extends RowData>({
  table,
  fullWidth = false,
  rowProps,
  virtualOpts,
  onScroll,
}: DataTableProps<Data>) => {
  const ref = useRef<HTMLDivElement>(null)

  const columnSizeVars = useMemo(() => {
    const lastId = table.getVisibleLeafColumns().at(-1)?.id

    return table
      .getFlatHeaders()
      .reduce<Record<string, string>>((vars, header) => {
        if (header.column.id != lastId) {
          vars[`--col-${header.column.id}-size`] = px(header.getSize())
        }
        return vars
      }, {}) as CSSProperties
  }, [table.getState().columnSizing, table.getState().columnSizingInfo])

  const { rows } = table.getRowModel()

  const virt = useVirtualizer({
    count: rows.length,
    getScrollElement: () => ref.current,
    estimateSize: () => DEFAULT_ROW_HEIGHT,
    overscan: 10,
    ...virtualOpts,
  })

  const { top, bottom, first, last, key } = getPosition(virt)

  useEffect(() => {
    onScroll({ first, last })
  }, [onScroll, first, last])

  const columnCount = table.getVisibleLeafColumns().length

  return (
    <div className="min-h-0 flex-1">
      <ScrollArea ref={ref}>
        <Table
          className={cn('table-fixed', fullWidth && 'w-full')}
          style={{
            ...columnSizeVars,
            ...(!fullWidth && { width: table.getTotalSize() }),
          }}
        >
          <TableHeader className="sticky top-0 z-10 border-b border-border bg-card/50 backdrop-blur-md">
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map(header => (
                  <HCell key={header.id} node={header} />
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {top > 0 && (
              <tr>
                <td colSpan={columnCount} style={{ height: top }} />
              </tr>
            )}
            {rows.length ? (
              <MemoBody
                {...{
                  rows,
                  rowProps,
                  virtualizer: virt,
                  viewport: key,
                }}
              />
            ) : (
              <Empty colSpan={table.getVisibleLeafColumns().length} />
            )}
            {bottom > 0 && (
              <tr>
                <td colSpan={columnCount} style={{ height: bottom }} />
              </tr>
            )}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  )
}
