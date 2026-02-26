import { mockIPC } from '@tauri-apps/api/mocks'

import { dispatchInvoke } from '@/tests'

export const installMock = () => {
  mockIPC(dispatchInvoke(), { shouldMockEvents: true })
}
