import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useRef } from "react";

import type { RecordRow } from "@/db.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import {
  isNearTopAtom,
  loadMoreRowsAtom,
  pendingNewRowsAtom,
  refreshRowsAtom,
  rowsStateAtom,
} from "@/db.tsx";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LevelBadge } from "@/components/level-badge";
import { Timestamp } from "@/components/timestamp";

interface ColumnMeta {
  headClassName?: string;
  cellClassName?: string;
}

const columnHelper = createColumnHelper<RecordRow>();
const NEAR_TOP_THRESHOLD_PX = 32;
const NEAR_BOTTOM_THRESHOLD_PX = 64;

export const columnDefinition = [
  columnHelper.accessor("ts_ms", {
    header: "Timestamp",
    cell: (info) => <Timestamp ms={info.getValue()} />,
    meta: {
      headClassName: "w-1 whitespace-nowrap",
      cellClassName: "whitespace-nowrap",
    },
  }),
  columnHelper.accessor("level", {
    header: "Level",
    cell: (info) => <LevelBadge level={info.getValue()} />,
    meta: {
      headClassName: "w-1 whitespace-nowrap",
      cellClassName: "whitespace-nowrap",
    },
  }),
  columnHelper.accessor("target", {
    header: "Source",
    meta: {
      // TODO: w- classes are not doing what you think they're doing. This should be
      // more dynamic so you can do column resizing.
      headClassName: "w-24",
      cellClassName: "w-24 truncate font-mono text-xs",
    },
  }),
  // TODO:
  // - This is going to be multi-line and should maybe to in a <pre>?
  columnHelper.accessor((row) => row.message, {
    id: "message",
    header: "Message",
  }),
];

export const RecordsTable = () => {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { rows, hasMore, isLoading } = useAtomValue(rowsStateAtom);
  const [isNearTop, setIsNearTop] = useAtom(isNearTopAtom);
  const pendingNewRows = useAtomValue(pendingNewRowsAtom);
  const refreshRows = useSetAtom(refreshRowsAtom);
  const loadMoreRows = useSetAtom(loadMoreRowsAtom);

  const table = useReactTable<RecordRow>({
    data: rows,
    columns: columnDefinition,
    getCoreRowModel: getCoreRowModel(),
  });

  const getViewport = useCallback(
    () =>
      scrollAreaRef.current?.querySelector<HTMLDivElement>(
        "[data-slot='scroll-area-viewport']",
      ) ?? null,
    [],
  );

  const handleScroll = (element: HTMLDivElement) => {
    setIsNearTop(element.scrollTop <= NEAR_TOP_THRESHOLD_PX);

    const distanceFromBottom =
      element.scrollHeight - (element.scrollTop + element.clientHeight);

    if (
      distanceFromBottom <= NEAR_BOTTOM_THRESHOLD_PX &&
      hasMore &&
      !isLoading
    ) {
      void loadMoreRows();
    }
  };

  // Keep a stable ref to the latest handleScroll to avoid re-attaching the listener
  const handleScrollRef = useRef(handleScroll);
  handleScrollRef.current = handleScroll;

  // Attach scroll listener to the ScrollArea viewport
  useEffect(() => {
    const viewport = getViewport();
    if (!viewport) return;

    setIsNearTop(viewport.scrollTop <= NEAR_TOP_THRESHOLD_PX);

    const onScroll = () => handleScrollRef.current(viewport);
    viewport.addEventListener("scroll", onScroll);
    return () => viewport.removeEventListener("scroll", onScroll);
  }, [getViewport, setIsNearTop]);

  useEffect(() => {
    if (!isNearTop || pendingNewRows === 0) {
      return;
    }

    void refreshRows();
  }, [isNearTop, pendingNewRows, refreshRows]);

  // Re-check scroll position when data changes
  useEffect(() => {
    const viewport = getViewport();
    if (!viewport) return;
    handleScroll(viewport);
  }, [hasMore, isLoading, rows.length]);

  return (
    <ScrollArea
      ref={scrollAreaRef}
      className="h-[calc(100vh-8rem)] w-full rounded-md border"
    >
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-card/50 border-b border-border backdrop-blur-md">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={
                    (header.column.columnDef.meta as ColumnMeta | undefined)
                      ?.headClassName
                  }
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={
                      (cell.column.columnDef.meta as ColumnMeta | undefined)
                        ?.cellClassName
                    }
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={columnDefinition.length}
                className="h-24 text-center"
              >
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </ScrollArea>
  );
};
