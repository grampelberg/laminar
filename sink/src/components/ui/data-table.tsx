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
  type ForwardedRef,
  type ReactElement,
  createContext,
  forwardRef,
  useEffect,
  useContext,
  useImperativeHandle,
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
import { getLogger } from '@/utils.ts'

import { ScrollArea } from './scroll-area'

const logger = getLogger(import.meta.url)

const DEFAULT_ROW_HEIGHT = 40

interface ColumnMeta {
  cellClassName?: string
  headerClassName?: string
}

export interface Viewport {
  first: number
  last: number
}

export interface DataTableHandle {
  scrollToTop: () => void
}

type RowPropsHook<Data extends RowData> = (
  row: TRow<Data>,
) => React.ComponentProps<'tr'>

const RowPropsContext = createContext<RowPropsHook<unknown> | undefined>(
  undefined,
)

const useRowProps = <Data extends RowData>(row: TRow<Data>) => {
  const hook = useContext(RowPropsContext) as RowPropsHook<Data>
  if (!hook) {
    return {}
  }

  return hook(row)
}

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

// Note: this is a wrapper *only* for the purpose of making sure that hooks are
// stable and don't change as part of components being added/removed.
const TRow = <Data extends RowData>({
  row,
  size,
}: {
  row: TRow<Data>
  size: number
}) => {
  const props = useRowProps<Data>(row)

  return (
    <TableRow {...props} style={{ ...props?.style, height: size }}>
      {row.getVisibleCells().map(cell => (
        <BCell key={cell.id} node={cell} />
      ))}
    </TableRow>
  )
}

interface BodyProps<Data extends RowData> {
  rows: TRow<Data>[]
  virtualizer: Virtualizer<HTMLDivElement, Element>
}

const Body = <Data extends RowData>({ rows, virtualizer }: BodyProps<Data>) =>
  virtualizer.getVirtualItems().map(item => {
    const row = rows[item.index]

    return <TRow key={row.id} row={row} size={item.size} />
  })

const MemoBody = memo(
  ({ viewport: _viewport, ...props }) => <Body {...props} />,
  (prev, next) => prev.viewport === next.viewport && prev.rows === next.rows,
) as <Data extends RowData>(
  props: BodyProps<Data> & { viewport: string },
) => ReactElement

const getPosition = (virtual: Virtualizer<HTMLDivElement, Element>) => {
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
  useRowProps?: RowPropsHook<Data>
  virtualOpts?: Partial<ReactVirtualizerOptions<HTMLDivElement, Element>>
  onScroll: (viewport: Viewport) => void
}

const DataTableInner = <Data extends RowData>(
  {
    table,
    fullWidth = false,
    useRowProps,
    virtualOpts,
    onScroll,
  }: DataTableProps<Data>,
  ref: ForwardedRef<DataTableHandle>,
) => {
  const viewportRef = useRef<HTMLDivElement>(null)

  useImperativeHandle(ref, () => ({
    scrollToTop: () => {
      viewportRef.current?.scrollTo({ top: 0 })
    },
  }))

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
    getScrollElement: () => viewportRef.current,
    estimateSize: () => DEFAULT_ROW_HEIGHT,
    overscan: 10,
    ...virtualOpts,
  })

  const { top, bottom, first, last, key } = getPosition(virt)
  const isResizingColumn = Boolean(
    table.getState().columnSizingInfo.isResizingColumn,
  )

  useEffect(() => {
    onScroll({ first, last })
  }, [onScroll, first, last])

  const columnCount = table.getVisibleLeafColumns().length

  return (
    <div
      className={cn(
        'min-h-0 flex-1',
        isResizingColumn && 'cursor-col-resize select-none',
      )}
    >
      <ScrollArea ref={viewportRef}>
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
              <RowPropsContext.Provider
                value={useRowProps as RowPropsHook<unknown> | undefined}
              >
                <MemoBody
                  {...{
                    rows,
                    virtualizer: virt,
                    viewport: key,
                  }}
                />
              </RowPropsContext.Provider>
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

type DataTableComponent = <Data extends RowData>(
  props: DataTableProps<Data> & { ref?: ForwardedRef<DataTableHandle> },
) => ReactElement

export const DataTable = forwardRef(DataTableInner) as DataTableComponent
