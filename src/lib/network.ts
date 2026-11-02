import { normalizeUrl } from '@/lib/utils'

export function isPrivateHost(url: string) {
  try {
    const hostname = new URL(normalizeUrl(url)).hostname
    return (
      hostname === 'localhost' ||
      hostname === '::1' ||
      hostname.endsWith('.local') ||
      /^127\./.test(hostname) ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^169\.254\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(hostname)
    )
  } catch {
    return false
  }
}

export function currentPageIsPrivate() {
  if (typeof window === 'undefined') return false
  return isPrivateHost(window.location.href)
}

export function resolveEffectiveNetwork(networkMode: 'auto' | 'internal' | 'external') {
  if (networkMode === 'internal') return 'internal'
  if (networkMode === 'external') return 'external'
  return currentPageIsPrivate() ? 'internal' : 'external'
}

export function resolveItemUrl(
  item: { url: string; lanUrl: string },
  networkMode: 'auto' | 'internal' | 'external',
) {
  const effective = resolveEffectiveNetwork(networkMode)
  if (effective === 'internal') return normalizeUrl(item.lanUrl || item.url)
  return normalizeUrl(item.url || item.lanUrl)
}

export function buildSearchUrl(template: string, query: string) {
  const trimmed = query.trim()
  if (!trimmed) return ''
  const encoded = encodeURIComponent(trimmed)
  return template.includes('%s') ? template.replaceAll('%s', encoded) : `${template}${encoded}`
}

export function openInNewTab(url: string) {
  if (!url) return
  window.open(url, '_blank', 'noopener,noreferrer')
}

export function openInCurrentTab(url: string) {
  if (!url) return
  window.location.assign(url)
}
