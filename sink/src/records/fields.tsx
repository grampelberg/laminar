import JsonView from '@uiw/react-json-view'
import { githubDarkTheme } from '@uiw/react-json-view/githubDark'
import { lightTheme } from '@uiw/react-json-view/light'
import { useAtomValue } from 'jotai'

import { ScrollArea } from '@/components/ui/scroll-area.tsx'
import { isDark } from '@/lib/utils.ts'
import { selectedAtom } from '@/records.tsx'

export const Fields = () => {
  const rawRow = useAtomValue(selectedAtom)
  if (!rawRow) {
    throw new Error('No record selected')
  }

  const { fields_json, ...row } = rawRow
  const value = { ...row, fields: JSON.parse(fields_json) }

  return (
    <ScrollArea className="h-[calc(100vh-8rem)] w-full min-w-0 rounded-md border p-3">
      <JsonView
        collapsed={2}
        displayDataTypes={false}
        value={value}
        style={isDark ? githubDarkTheme : lightTheme}
      />
    </ScrollArea>
  )
}
