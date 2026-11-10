import type { OpenMode } from '@/types'

/**
 * Android browsers that can be named in an Intent URL so http(s) links stay
 * in the browser instead of being stolen by a verified App Link.
 */
const ANDROID_BROWSER_PACKAGES: Array<{ test: RegExp; packageName: string }> = [
  { test: /EdgA\//i, packageName: 'com.microsoft.emmx' },
  { test: /OPR\//i, packageName: 'com.opera.browser' },
  { test: /SamsungBrowser\//i, packageName: 'com.sec.android.app.sbrowser' },
  { test: /Firefox\//i, packageName: 'org.mozilla.firefox' },
  { test: /YaBrowser\//i, packageName: 'com.yandex.browser' },
  { test: /UCBrowser|UCWEB/i, packageName: 'com.UCMobile' },
  { test: /HuaweiBrowser|HBPC\//i, packageName: 'com.huawei.browser' },
  { test: /MiuiBrowser|XiaoMi/i, packageName: 'com.mi.globalbrowser' },
  { test: /DuckDuckGo/i, packageName: 'com.duckduckgo.mobile.android' },
  { test: /Brave/i, packageName: 'com.brave.browser' },
]

export function androidBrowserPackage(ua: string): string | null {
  if (!/Android/i.test(ua)) return null
  for (const entry of ANDROID_BROWSER_PACKAGES) {
    if (entry.test.test(ua)) return entry.packageName
  }
  // Chrome and unnamed Chromium forks. Check last because most Android
  // browsers include "Chrome/" in their UA.
  if (/Chrome\//i.test(ua)) return 'com.android.chrome'
  return null
}

/**
 * On Android Chrome (and other known Android browsers), wrap an http(s) URL in
 * an Intent that explicitly names the current browser. Without this, a card
 * click becomes a VIEW intent and a verified app (Bilibili, YouTube, GitHub,
 * etc.) opens immediately with no prompt.
 */
export function stayInBrowserUrl(url: string, ua?: string): string {
  const userAgent = ua ?? (typeof navigator === 'undefined' ? '' : navigator.userAgent)
  const packageName = androidBrowserPackage(userAgent)
  if (!packageName) return url
  if (!/^https?:\/\//i.test(url) || /^intent:/i.test(url)) return url

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return url
  }

  const scheme = parsed.protocol.replace(':', '')
  // ';' would start a new Intent extra if left in the opaque part.
  const opaque = `${parsed.host}${parsed.pathname}${parsed.search}`.replaceAll(';', '%3B')
  const fallback = encodeURIComponent(url)
  return `intent://${opaque}#Intent;scheme=${scheme};action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=${packageName};S.browser_fallback_url=${fallback};end`
}

function clickAnchor(href: string, target: '_blank' | '_self') {
  const link = document.createElement('a')
  link.href = href
  link.target = target
  link.rel = 'noopener noreferrer'
  link.referrerPolicy = 'no-referrer'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export function openExternalUrl(url: string, mode: OpenMode = 'new'): 'opened' | 'blocked' {
  const href = stayInBrowserUrl(url)
  const useIntent = href.startsWith('intent:')
  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)

  if (mode === 'self') {
    window.location.assign(href)
    return 'opened'
  }

  if (useIntent || isAndroid) {
    // Intent URLs must be fired from a user-gesture anchor click.
    // window.open(intent:) is ignored or treated as a regular popup.
    // On Android, skip about:blank → replace: that second navigation is
    // exactly what Chrome hands off to an installed app.
    clickAnchor(href, '_blank')
    return 'opened'
  }

  // `noopener` makes window.open() return null even on success, so open a
  // blank tab first to detect a real popup blocker, then navigate it.
  const opened = window.open('about:blank', '_blank')
  if (!opened) return 'blocked'
  try {
    opened.opener = null
  } catch {
    // Cross-origin restrictions can make the opener read-only; navigation
    // below is still safe because the new window starts on about:blank.
  }
  opened.location.replace(url)
  return 'opened'
}
