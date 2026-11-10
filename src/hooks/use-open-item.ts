import { useCallback } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '@/store/app-store'
import { resolveItemUrl } from '@/lib/network'
import { openExternalUrl } from '@/lib/open-url'
import { normalizeUrl } from '@/lib/utils'
import type { NavItem, OpenMode } from '@/types'

export type UrlKind = 'effective' | 'external' | 'internal'

export function useOpenItem() {
  const networkMode = useAppStore((state) => state.config.networkMode)

  const openRawUrl = useCallback((rawUrl: string, mode: OpenMode = 'new') => {
    const url = normalizeUrl(rawUrl)
    if (!url) {
      toast.error('这个卡片还没有配置地址')
      return
    }

    if (openExternalUrl(url, mode === 'self' ? 'self' : 'new') === 'blocked') {
      toast.error('新窗口被浏览器拦截，请允许弹出窗口')
    }
  }, [])

  const openItem = useCallback(
    (item: NavItem, overrides?: { mode?: OpenMode; kind?: UrlKind }) => {
      const kind = overrides?.kind ?? 'effective'
      const url =
        kind === 'internal'
          ? normalizeUrl(item.lanUrl)
          : kind === 'external'
            ? normalizeUrl(item.url)
            : resolveItemUrl(item, networkMode)

      if (!url) {
        toast.error(
          kind === 'internal' ? '这个卡片还没有配置内网地址' : '这个卡片还没有配置访问地址',
        )
        return
      }

      // Legacy data may still contain the removed "window" mode.
      const mode = overrides?.mode ?? item.openMode
      openRawUrl(url, mode === 'self' ? 'self' : 'new')
    },
    [networkMode, openRawUrl],
  )

  return { openItem, openRawUrl }
}
