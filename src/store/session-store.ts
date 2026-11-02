import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Session } from '@/types'

const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000

interface SessionState {
  session: Session | null
  startSession: (expiresAt?: number) => void
  clearSession: () => void
  ensureValid: () => boolean
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      session: null,
      startSession: (expiresAt) =>
        set({
          session: {
            expiresAt:
              typeof expiresAt === 'number' && expiresAt > Date.now()
                ? expiresAt
                : Date.now() + SESSION_DURATION,
          },
        }),
      clearSession: () => set({ session: null }),
      ensureValid: () => {
        const session = get().session
        if (!session) return false
        if (session.expiresAt <= Date.now()) {
          set({ session: null })
          return false
        }
        return true
      },
    }),
    {
      name: 'hares-panel-session',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ session: state.session }),
    },
  ),
)
