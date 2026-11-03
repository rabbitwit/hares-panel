import { create } from 'zustand'
import { checkForAppUpdate, type AppUpdateInfo } from '@/lib/update'

export type UpdateStatus = 'idle' | 'checking' | 'done' | 'error'

interface UpdateState {
  status: UpdateStatus
  info: AppUpdateInfo | null
  error: string | null
  check: (options?: { force?: boolean }) => Promise<void>
}

let pending: Promise<void> | null = null

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  return '检查更新失败，请稍后重试'
}

export const useUpdateStore = create<UpdateState>((set) => ({
  status: 'idle',
  info: null,
  error: null,
  check: async (options = {}) => {
    if (pending) return pending
    set({ status: 'checking', error: null })
    pending = (async () => {
      try {
        const info = await checkForAppUpdate(options)
        set({ status: 'done', info, error: null })
      } catch (error) {
        set({ status: 'error', error: errorMessage(error) })
      }
    })().finally(() => {
      pending = null
    })
    return pending
  },
}))
