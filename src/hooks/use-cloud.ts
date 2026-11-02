import { useEffect } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '@/store/app-store'
import { useCloudStore } from '@/store/cloud-store'

export function useCloudBootstrap() {
  const bootstrap = useCloudStore((state) => state.bootstrap)
  useEffect(() => {
    void bootstrap()
  }, [bootstrap])
}

/** Refresh the session once a day, or when the tab becomes active again. */
const SESSION_RENEW_WITHIN_MS = 6 * 24 * 60 * 60 * 1000
const SESSION_CHECK_INTERVAL_MS = 60 * 60 * 1000

export function useSessionKeepAlive() {
  const status = useCloudStore((state) => state.status)

  useEffect(() => {
    if (status !== 'connected') return

    const renew = () => {
      const state = useCloudStore.getState()
      if (state.status !== 'connected' || !state.token || !state.expiresAt) return
      // With a 7-day token, renewing only when less than 6 days remain limits
      // this to roughly one request per day of active use.
      if (state.expiresAt - Date.now() > SESSION_RENEW_WITHIN_MS) return
      void state.refreshSession()
    }

    const onActive = () => {
      if (document.visibilityState === 'visible') renew()
    }

    renew()
    const timer = window.setInterval(renew, SESSION_CHECK_INTERVAL_MS)
    window.addEventListener('focus', onActive)
    document.addEventListener('visibilitychange', onActive)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', onActive)
      document.removeEventListener('visibilitychange', onActive)
    }
  }, [status])
}

/**
 * Saves local edits to the server shortly after they settle. Remote hydration
 * is ignored via the `applyingRemote` guard to avoid feedback loops.
 */
export function useCloudAutoSave() {
  const status = useCloudStore((state) => state.status)

  useEffect(() => {
    if (status !== 'connected') return
    let timer: number | undefined
    const unsubscribe = useAppStore.subscribe((state, previous) => {
      const changed =
        state.config !== previous.config ||
        state.groups !== previous.groups ||
        state.items !== previous.items ||
        state.searchEngines !== previous.searchEngines ||
        state.gallery !== previous.gallery
      if (!changed) return
      if (useCloudStore.getState().applyingRemote) return
      if (timer) window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        void (async () => {
          const previousError = useCloudStore.getState().error
          const ok = await useCloudStore.getState().push()
          const nextError = useCloudStore.getState().error
          if (!ok && nextError && nextError !== previousError) {
            toast.error(nextError)
          }
        })()
      }, 1500)
    })
    return () => {
      if (timer) window.clearTimeout(timer)
      unsubscribe()
    }
  }, [status])

  useEffect(() => {
    if (status !== 'connected') return
    // Retry the pending state when the browser regains connectivity.
    const retry = () => {
      if (!useCloudStore.getState().error) return
      void useCloudStore.getState().push()
    }
    window.addEventListener('online', retry)
    return () => window.removeEventListener('online', retry)
  }, [status])
}
