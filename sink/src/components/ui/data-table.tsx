import {
  flexRender,
  type Cell as TCell,
  type Header as THead,
  type Row as TRow,
  type Table as TTable,
  type RowData,
} from '@tanstack/react-table'
import { useMemo, type CSSProperties } from 'react'

import {
  Table,
  TableBody,
  TableCell as UITableCell,
  TableHead as UITableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.tsx'
import { cn, memo } from '@/lib/utils.ts'
import { log } from '@/log.ts'

const logger = log('data-table')

type Node<Data extends RowData, Value = unknown> =
  | THead<Data, Value>
  | TCell<Data, Value>

interface ColumnMeta {
  cellClassName?: string
  headerClassName?: string
}

const isHeaderNode = <Data extends RowData, Value = unknown>(
  node: Node<Data>,
): node is THead<Data, Value> => 'isPlaceholder' in node

const getStyle = <Data extends RowData>(node: Node<Data>) => {
  const meta = (node.column.columnDef.meta || {}) as ColumnMeta

  return {
    className: isHeaderNode(node) ? meta.headerClassName : meta.cellClassName,
    style: {
      width: `var(--col-${node.column.id}-size)`,
    },
  }
}

const isLast = <Data extends RowData>(node: Node<Data>): boolean =>
  node.getContext().table.getVisibleLeafColumns().at(-1)?.id === node.column.id

const Cell = <Data extends RowData>({
  node,
  children,
  ...props
}: {
  node: Node<Data>
  children: React.ReactNode
} & React.ComponentProps<'td'>) => {
  const Component = isHeaderNode(node) ? UITableHead : UITableCell
  const { className, style } = getStyle(node)

  return (
    <Component
      {...props}
      style={style}
      className={cn(className, props.className)}
    >
      {children}
    </Component>
  )
}

const HeadCell = <Data extends RowData, Value = unknown>({
  node,
}: {
  node: THead<Data, Value>
}) => (
  <Cell node={node} className="group relative" data-col-id={node.column.id}>
    {!node.isPlaceholder &&
      flexRender(node.column.columnDef.header, node.getContext())}
    {node.column.getCanResize() && !isLast(node) && (
      <div
        onMouseDown={node.getResizeHandler()}
        onTouchStart={node.getResizeHandler()}
        className={cn(
          'absolute top-0 right-0 h-full w-1.5 cursor-col-resize touch-none select-none group-hover:bg-foreground/40 active:bg-foreground/40',
          node.column.getIsResizing() && 'isResizing',
        )}
      />
    )}
  </Cell>
)

const BodyCell = <Data extends RowData, Value = unknown>({
  node,
}: {
  node: TCell<Data, Value>
}) => (
  <Cell node={node}>
    {flexRender(node.column.columnDef.cell, node.getContext())}
  </Cell>
)

type BodyRowPropsFn<Data extends RowData> = (
  row: TRow<Data>,
) => React.ComponentProps<'tr'> | undefined

const Content = <Data extends RowData>({
  table,
  bodyRowProps,
}: {
  table: TTable<Data>
  bodyRowProps?: BodyRowPropsFn<Data>
}) => (
  <>
    <TableHeader className="sticky top-0 z-10 border-b border-border bg-card/50 backdrop-blur-md">
      {table.getHeaderGroups().map(headerGroup => (
        <TableRow key={headerGroup.id} className="hover:bg-transparent">
          {headerGroup.headers.map(header => (
            <HeadCell key={header.id} node={header} />
          ))}
        </TableRow>
      ))}
    </TableHeader>
    <TableBody>
      {table.getRowModel().rows.length > 0 ? (
        table.getRowModel().rows.map(row => {
          const rowProps = bodyRowProps?.(row)
          return (
            <TableRow key={row.id} {...rowProps}>
              {row.getVisibleCells().map(cell => (
                <BodyCell key={cell.id} node={cell} />
              ))}
            </TableRow>
          )
        })
      ) : (
        <TableRow>
          <UITableCell
            colSpan={table.getVisibleLeafColumns().length}
            className="h-24 text-center"
          >
            No results.
          </UITableCell>
        </TableRow>
      )}
    </TableBody>
  </>
)

const MemoContent = memo(
  Content,
  (prev, next) => prev.table.options.data === next.table.options.data,
)

export const DataTable = <Data extends RowData>({
  table,
  fullWidth = false,
  bodyRowProps,
}: {
  table: TTable<Data>
  fullWidth?: boolean
  bodyRowProps?: BodyRowPropsFn<Data>
}) => {
  const columnSizeVars = useMemo(
    () =>
      table.getFlatHeaders().reduce<Record<string, string>>((vars, header) => {
        if (!isLast(header)) {
          vars[`--col-${header.column.id}-size`] = `${header.getSize()}px`
        }
        return vars
      }, {}) as CSSProperties,
    [table.getState().columnSizing, table.getState().columnSizingInfo],
  )

  logger(table.options.data)

  return (
    <Table
      className={cn('table-fixed', fullWidth && 'w-full')}
      style={{
        ...columnSizeVars,
        ...(!fullWidth && { width: table.getTotalSize() }),
      }}
    >
      {table.getState().columnSizingInfo.isResizingColumn ? (
        <MemoContent table={table} bodyRowProps={bodyRowProps} />
      ) : (
        <Content table={table} bodyRowProps={bodyRowProps} />
      )}
    </Table>
  )
}
