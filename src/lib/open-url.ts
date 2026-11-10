import type { OpenMode } from '@/types'

function clickAnchor(href: string, target: '_blank' | '_self') {
  const link = document.createElement('a')
  link.href = href
  link.target = target
  if (target === '_blank') link.rel = 'noopener noreferrer'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

/**
 * Open a URL from a JS click (context menu, search, …).
 *
 * Do not use Android `intent:` URLs: Chrome still hands those to apps, and
 * every other browser ignores them so the click appears to do nothing.
 * Card taps should be real `<a href>` links instead of calling this.
 */
export function openExternalUrl(url: string, mode: OpenMode = 'new'): 'opened' | 'blocked' {
  if (mode === 'self') {
    window.location.assign(url)
    return 'opened'
  }

  // Open the real http(s) URL in the same user gesture. The previous
  // about:blank → replace dance is treated as a VIEW intent on Android
  // Chrome and launches an installed app without asking.
  const opened = window.open(url, '_blank')
  if (opened) {
    try {
      opened.opener = null
    } catch {
      // Cross-origin restrictions can make opener read-only.
    }
    return 'opened'
  }

  clickAnchor(url, '_blank')
  return 'opened'
}
