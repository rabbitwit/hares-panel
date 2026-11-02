import { isPrivateHostname, normalizeUrl } from '@/lib/utils'

const ICON_LOAD_TIMEOUT_MS = 1500
const CRAVATAR_FAVICON_ENDPOINT = 'https://api.xinac.net/icon'

function parseHttpUrl(input: string): URL | null {
  try {
    const url = new URL(normalizeUrl(input.trim()))
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url
  } catch {
    return null
  }
}

function normalizeDomain(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
    return url.hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return ''
  }
}

function cravatarFaviconUrl(domain: string): string {
  return `${CRAVATAR_FAVICON_ENDPOINT}?url=${encodeURIComponent(domain)}`
}

/**
 * Old cards may still store Google's favicon URL, which is unreachable from
 * mainland China. Rewrite those references to the China-accelerated provider
 * while keeping all other icon formats untouched.
 */
export function rewriteLegacyGoogleFavicon(icon: string): string {
  if (!icon) return icon
  try {
    const url = new URL(icon)
    if (!/(^|\.)google\.[a-z.]+$/i.test(url.hostname)) return icon
    if (!url.pathname.startsWith('/s2/favicons')) return icon
    const domain = normalizeDomain(url.searchParams.get('domain') || '')
    return domain ? cravatarFaviconUrl(domain) : icon
  } catch {
    return icon
  }
}

function canLoadImage(src: string, timeoutMs = ICON_LOAD_TIMEOUT_MS): Promise<boolean> {
  if (typeof window === 'undefined' || typeof Image === 'undefined') return Promise.resolve(false)
  return new Promise((resolve) => {
    const image = new Image()
    let settled = false
    let timer: number | undefined

    const finish = (ok: boolean) => {
      if (settled) return
      settled = true
      if (timer !== undefined) window.clearTimeout(timer)
      image.onload = null
      image.onerror = null
      resolve(ok)
    }

    timer = window.setTimeout(() => finish(false), timeoutMs)
    image.onload = () => finish(image.naturalWidth > 0 || image.naturalHeight > 0)
    image.onerror = () => finish(false)
    image.referrerPolicy = 'no-referrer'
    image.decoding = 'async'
    image.src = src
  })
}

/**
 * Resolve a website icon without relying on Google:
 * 1. try the target site's own favicon files;
 * 2. fall back to Cravatar's China-accelerated favicon API.
 */
export async function findFavicon(input: string): Promise<string | null> {
  const parsed = parseHttpUrl(input)
  if (!parsed) return null

  const pageIsHttps =
    typeof window !== 'undefined' && window.location.protocol === 'https:'
  const mixedContent = pageIsHttps && parsed.protocol === 'http:'

  if (!mixedContent) {
    const directCandidates = [
      `${parsed.origin}/favicon.ico`,
      `${parsed.origin}/favicon.png`,
      `${parsed.origin}/favicon.svg`,
      `${parsed.origin}/apple-touch-icon.png`,
    ]
    const results = await Promise.all(
      directCandidates.map((candidate) => canLoadImage(candidate)),
    )
    const firstMatch = results.findIndex(Boolean)
    if (firstMatch >= 0) return directCandidates[firstMatch]
  }

  // A server-side favicon service cannot reach private/LAN hosts, and would
  // only return a generic placeholder for them. Let the user choose manually.
  if (isPrivateHostname(parsed.hostname)) return null

  const domain = normalizeDomain(parsed.hostname)
  if (!domain) return null
  const fallback = cravatarFaviconUrl(domain)
  return (await canLoadImage(fallback, 1800)) ? fallback : null
}
