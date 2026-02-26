import {
  createColumnHelper,
  getCoreRowModel,
  useReactTable,
  flexRender,
  type Header as THead,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { AnimatePresence, motion } from 'framer-motion'
import { type CSSProperties, useRef, useMemo } from 'react'

import {
  Table,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
  TableBody,
} from '@/components/ui/table'
import { cn, px } from '@/lib/utils'

import data from './data.json'

interface SampleRow {
  message: string
  target: string
  name: string
}

const builder = createColumnHelper<SampleRow>()

const schema = [
  builder.accessor('target', {
    size: 100,
  }),
  builder.accessor('name', {
    size: 100,
  }),
  builder.accessor('message', {}),
]

const lots = [...data, ...data, ...data, ...data, ...data] as SampleRow[]
const SAMPLE_ROW_HEIGHT = 35

const getStyle = (node: THead<SampleRow, unknown>) => ({
  style: {
    width: `var(--col-${node.column.id}-size)`,
  },
})

export const SampleTable = () => {
  const table = useReactTable<SampleRow>({
    columns: schema,
    data: lots,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: 'onChange',
    columnResizeDirection: 'ltr',
  })

  const ref = useRef<HTMLDivElement>(null)

  const { rows } = table.getRowModel()

  const virt = useVirtualizer({
    count: rows.length,
    getScrollElement: () => ref.current,
    estimateSize: () => SAMPLE_ROW_HEIGHT,
    overscan: 25,
  })

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

  return (
    <div ref={ref} className="container mx-auto overflow-auto">
      <AnimatePresence>
        <Table className="w-full table-fixed" style={{ ...columnSizeVars }}>
          <TableHeader className="sticky top-0 z-10 border-b border-border bg-card/50 backdrop-blur-md">
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map(node => (
                  <TableHead
                    key={node.id}
                    className="group relative [&:last-child>div]:hidden"
                    {...getStyle(node)}
                  >
                    {flexRender(
                      node.column.columnDef.header,
                      node.getContext(),
                    )}
                    <div
                      onMouseDown={node.getResizeHandler()}
                      onTouchStart={node.getResizeHandler()}
                      className={cn(
                        'absolute top-0 right-0 h-full w-1.5 cursor-col-resize touch-none select-none group-hover:bg-foreground/40 active:bg-foreground/40',
                      )}
                    />
                  </TableHead>
                ))}
              </TableRow>
            ))}
            {/*<TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Message</TableHead>
            </TableRow>*/}
          </TableHeader>
          <TableBody>
            {virt.getVirtualItems().map((item, index) => {
              const row = rows[item.index]
              return (
                <motion.tr
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0 }}
                  key={row.id}
                  style={{
                    height: `${item.size}px`,
                    transform: `translateY(${item.start - index * item.size}px)`,
                  }}
                >
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id} className="truncate">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                  {/*<TableCell>{row.ts_ms}</TableCell>
                  <TableCell>{row.level}</TableCell>
                  <TableCell>{row.target}</TableCell>
                  <TableCell>{row.message}</TableCell>*/}
                </motion.tr>
              )
            })}
          </TableBody>
        </Table>
      </AnimatePresence>
    </div>
  )
}
