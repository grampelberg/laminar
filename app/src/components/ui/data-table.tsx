import {
  flexRender,
  type Cell as TCell,
  type Header as THead,
  type Row as TRow,
  type Table as TTable,
  type RowData,
} from '@tanstack/react-table'
import {
  type Virtualizer,
} from '@tanstack/react-virtual'
import { type CSSProperties, type ReactElement, createContext, useContext, useMemo } from 'react'

import {
  Table,
  TableBody,
  TableCell as UITableCell,
  TableHead as UITableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.tsx'
import { cn, px, memo } from '@/lib/utils.ts'

const LOADING_DELAY_STEP_MS = 40

interface ColumnMeta {
  cellClassName?: string
  headerClassName?: string
}

export interface Viewport {
  top: boolean
  bottom: boolean
}

type RowPropsHook<Data extends RowData> = (
  row: TRow<Data>,
) => React.ComponentProps<'tr'>

const Loading = <Data extends RowData>({
  columns,
  rowCount,
}: {
  columns: ReturnType<TTable<Data>['getVisibleLeafColumns']>
  rowCount: number
}) =>
  Array.from({ length: rowCount }).map((_, index) => (
    <TableRow className="h-10" key={`loading-${index}`}>
      {columns.map(
        (column: ReturnType<TTable<Data>['getVisibleLeafColumns']>[number]) => {
          const meta = (column.columnDef.meta || {}) as ColumnMeta
          return (
            <UITableCell className={meta.cellClassName} key={column.id}>
              <div
                className="h-3 w-full animate-pulse rounded-sm bg-muted/70"
                style={{
                  animationDelay: `${index * LOADING_DELAY_STEP_MS}ms`,
                }}
              />
            </UITableCell>
          )
        },
      )}
    </TableRow>
  ))

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

const getLayout = (virtual: Virtualizer<HTMLDivElement, Element>) => {
  const items = virtual.getVirtualItems()
  const first = items[0]?.index ?? 0
  const last = items.at(-1)?.index ?? 0

  return {
    spacer: {
      top: items[0]?.start ?? 0,
      bottom: virtual.getTotalSize() - (items.at(-1)?.end ?? 0),
    },
    key: `${first}:${last}:${items.length}`,
  }
}

export interface DataTableProps<Data extends RowData> {
  table: TTable<Data>
  fullWidth?: boolean
  loading?: boolean
  loadingRowCount?: number
  getRowProps?: RowPropsHook<Data>
  virtual: Virtualizer<HTMLDivElement, Element>
}

export const DataTable = <Data extends RowData>({
  table,
  fullWidth = false,
  loading = false,
  loadingRowCount = 12,
  getRowProps,
  virtual,
}: DataTableProps<Data>) => {
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

  const { spacer, key } = getLayout(virtual)
  const isResizingColumn = Boolean(
    table.getState().columnSizingInfo.isResizingColumn,
  )

  const columnCount = table.getVisibleLeafColumns().length
  const columns = table.getVisibleLeafColumns()

  return (
    <div
      className={cn(
        'min-h-0 flex-1',
        isResizingColumn && 'cursor-col-resize select-none',
      )}
    >
      <Table
        className={cn('table-fixed', fullWidth && 'w-full')}
        style={{
          ...columnSizeVars,
          ...(!fullWidth && { width: table.getTotalSize() }),
        }}
      >
        <TableHeader className="sticky top-0 z-30 border-b border-border bg-card/50 backdrop-blur-md">
          {table.getHeaderGroups().map(headerGroup => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map(header => (
                <HCell key={header.id} node={header} />
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {spacer.top > 0 && (
            <tr>
              <td colSpan={columnCount} style={{ height: spacer.top }} />
            </tr>
          )}
          {loading && <Loading columns={columns} rowCount={loadingRowCount} />}
          {!loading && rows.length === 0 && <Empty colSpan={columnCount} />}
          {rows.length > 0 && (
            <RowPropsContext.Provider
              value={getRowProps as RowPropsHook<unknown> | undefined}
            >
              <MemoBody
                {...{
                  rows,
                  virtualizer: virtual,
                  viewport: key,
                }}
              />
            </RowPropsContext.Provider>
          )}
          {spacer.bottom > 0 && (
            <tr>
              <td colSpan={columnCount} style={{ height: spacer.bottom }} />
            </tr>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
