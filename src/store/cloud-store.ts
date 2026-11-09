import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { getAppData, useAppStore } from '@/store/app-store'
import {
  CloudApiError,
  cloudLogin,
  fetchCloudState,
  fetchSyncMeta,
  probeCloudHealth,
  pushCloudState,
  refreshCloudSession,
  type CloudHealth,
  type CloudSyncMeta,
  type CloudSession,
} from '@/lib/cloud'
import { useSessionStore } from '@/store/session-store'
import type { AppData } from '@/types'

export type CloudStatus = 'checking' | 'unavailable' | 'available' | 'connected'

interface CloudState {
  status: CloudStatus
  info: CloudHealth | null
  token: string | null
  expiresAt: number | null
  lastSyncAt: number | null
  /** Last cross-instance sync status, shown read-only on the target/public side. */
  syncMeta: CloudSyncMeta | null
  busy: boolean
  error: string | null
  loaded: boolean
  /** The server has no state document yet (fresh deployment or cleared data). */
  empty: boolean
  applyingRemote: boolean
  bootstrap: () => Promise<void>
  retry: () => Promise<void>
  login: (password: string) => Promise<number>
  refreshSession: () => Promise<boolean>
  push: () => Promise<boolean>
  /** Re-fetch the full state from the server (used after a sync download or an import). */
  reload: () => Promise<boolean>
  /** Refresh this instance's last cross-instance sync status. */
  loadSyncMeta: () => Promise<void>
  disconnect: () => void
  clearError: () => void
}

let bootStarted = false

function applyRemote(data: AppData, updatedAt: number) {
  useCloudStore.setState({ applyingRemote: true })
  useAppStore.getState().applyRemoteState(data)
  useCloudStore.setState({ applyingRemote: false, lastSyncAt: updatedAt || null, empty: false })
}

function applyRenewedSession(session: CloudSession) {
  useCloudStore.setState({ token: session.token, expiresAt: session.expiresAt })
  // Keep the local admin session in sync so the UI stays logged in while the
  // server-side token is being renewed.
  if (useSessionStore.getState().session) {
    useSessionStore.getState().startSession(session.expiresAt)
  }
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof CloudApiError) {
    if (error.status === 0 && error.code === 'network') {
      return '无法连接服务端，请检查网络后重试；若持续失败，可能是当前网络阻断了平台默认域名（如 workers.dev / edgeone.cool）。'
    }
    return error.message
  }
  if (error instanceof Error) return error.message
  return fallback
}

export const useCloudStore = create<CloudState>()(
  persist(
    (set, get) => ({
      status: 'checking',
      info: null,
      token: null,
      expiresAt: null,
      lastSyncAt: null,
      syncMeta: null,
      busy: false,
      error: null,
      loaded: false,
      empty: false,
      applyingRemote: false,

      bootstrap: async () => {
        if (bootStarted || get().loaded) return
        bootStarted = true
        set({ status: 'checking', error: null })

        const { info, error: healthError } = await probeCloudHealth()
        if (!info || !info.ok || !info.storage) {
          set({
            status: 'unavailable',
            info,
            loaded: true,
            error: info
              ? '服务端已响应，但尚未配置 KV / D1 / Upstash Redis / Docker 本地文件存储。'
              : healthError || '无法连接服务端 API（/api/health）。',
          })
          return
        }
        set({ info })

        const storedToken = get().token
        const storedExpiry = get().expiresAt
        const tokenValid = Boolean(storedToken && storedExpiry && storedExpiry > Date.now())

        if (tokenValid && storedToken) {
          // Sliding session: renew a valid token on every app start, so
          // opening the panel within 7 days keeps the admin logged in.
          let activeToken = storedToken
          try {
            const renewed = await refreshCloudSession(storedToken)
            activeToken = renewed.token
            applyRenewedSession(renewed)
          } catch (error) {
            if (error instanceof CloudApiError && error.status === 401) {
              set({ token: null, expiresAt: null })
              activeToken = ''
            } else {
              // Refresh failed for a transient reason; the current token may
              // still be valid, so fall through and try reading the state.
              set({ error: errorMessage(error, '登录续期失败') })
            }
          }

          if (activeToken) {
            try {
              const remote = await fetchCloudState(activeToken)
              if (remote) {
                applyRemote(remote.data, remote.updatedAt)
                set({ status: 'connected', loaded: true, error: null, empty: false })
              } else {
                set({ status: 'connected', loaded: true, lastSyncAt: null, empty: true })
              }
              return
            } catch (error) {
              if (!(error instanceof CloudApiError && error.status === 401)) {
                // Token might be valid but the request failed; fall back to the
                // public projection instead of silently showing stale data.
                set({ token: null, expiresAt: null, error: errorMessage(error, '读取服务端数据失败') })
              } else {
                set({ token: null, expiresAt: null })
              }
            }
          }
        } else if (storedToken) {
          set({ token: null, expiresAt: null })
        }

        try {
          const remote = await fetchCloudState()
          if (remote) {
            applyRemote(remote.data, remote.updatedAt)
            set({ status: 'available', loaded: true, error: null, empty: false })
          } else {
            set({ status: 'available', loaded: true, error: null, empty: true })
          }
        } catch (error) {
          set({
            status: 'unavailable',
            loaded: true,
            error: errorMessage(error, '读取服务端数据失败'),
          })
        }
      },

      retry: async () => {
        bootStarted = false
        set({ loaded: false, status: 'checking', error: null })
        await get().bootstrap()
      },

      login: async (password) => {
        set({ busy: true, error: null })
        try {
          const session = await cloudLogin(password)
          const remote = await fetchCloudState(session.token)
          if (remote) {
            applyRemote(remote.data, remote.updatedAt)
          } else {
            // Fresh deployment: seed the server with the built-in starter data.
            const data = getAppData()
            applyRemote(data, 0)
            try {
              const saved = await pushCloudState(session.token, data)
              set({ lastSyncAt: saved.updatedAt })
            } catch (pushError) {
              // Keep the session so the admin can retry from settings.
              set({ error: `初始化上传失败：${errorMessage(pushError, '未知错误')}` })
            }
          }
          set({
            status: 'connected',
            token: session.token,
            expiresAt: session.expiresAt,
            busy: false,
            empty: false,
          })
          return session.expiresAt
        } catch (error) {
          const message = errorMessage(error, '登录失败')
          set({ busy: false, error: message })
          throw error instanceof Error ? error : new Error(message)
        }
      },

      refreshSession: async () => {
        const { token, status } = get()
        if (!token || status !== 'connected') return false
        try {
          const renewed = await refreshCloudSession(token)
          applyRenewedSession(renewed)
          return true
        } catch (error) {
          if (error instanceof CloudApiError && error.status === 401) {
            set({
              token: null,
              expiresAt: null,
              status: 'available',
              error: '登录已过期，请重新登录',
            })
            useSessionStore.getState().clearSession()
          }
          return false
        }
      },

      push: async () => {
        const { token, status } = get()
        if (!token || status !== 'connected') return false
        set({ busy: true })
        try {
          const saved = await pushCloudState(token, getAppData())
          set({ lastSyncAt: saved.updatedAt, busy: false, error: null, empty: false })
          return true
        } catch (error) {
          if (error instanceof CloudApiError && error.status === 401) {
            set({
              token: null,
              expiresAt: null,
              status: 'available',
              busy: false,
              error: '登录已过期，请重新登录',
            })
          } else {
            set({ busy: false, error: errorMessage(error, '保存到服务端失败') })
          }
          return false
        }
      },

      disconnect: () =>
        set({ status: 'available', token: null, expiresAt: null, error: null }),

      reload: async () => {
        const { token, status } = get()
        if (!token || status !== 'connected') return false
        set({ busy: true })
        try {
          const remote = await fetchCloudState(token)
          if (remote) {
            applyRemote(remote.data, remote.updatedAt)
          }
          set({ busy: false, error: null, empty: !remote })
          return Boolean(remote)
        } catch (error) {
          set({ busy: false, error: errorMessage(error, '重新读取服务端数据失败') })
          return false
        }
      },

      loadSyncMeta: async () => {
        const { token, status } = get()
        if (!token || status !== 'connected') return
        try {
          const meta = await fetchSyncMeta(token)
          set({ syncMeta: meta })
        } catch {
          // Non-fatal: the public target may be an older version without the
          // status endpoint; just leave syncMeta unchanged.
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'hares-panel-cloud',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        token: state.token,
        expiresAt: state.expiresAt,
      }),
    },
  ),
)
