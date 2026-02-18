import { Controls } from '@/records/controls.tsx'
import { RecordDetail } from '@/records/detail.tsx'
import { RecordsTable } from '@/records/table.tsx'
import { getLogger } from '@/utils.ts'

const logger = getLogger(import.meta.url)

export const Records = () => (
  <div>
    <div className="flex h-[calc(100vh-8rem)] min-w-0 flex-col rounded-md border">
      <Controls />
      <RecordsTable />
    </div>
    <RecordDetail />
  </div>
)
