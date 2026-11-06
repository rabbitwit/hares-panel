/**
 * Bing daily wallpaper support.
 *
 * The browser never calls the Bing upstream API directly: providers such as
 * `api.bimg.cc` and `bing.xinac.net` do not send `Access-Control-Allow-Origin`,
 * so a cross-origin `fetch()` is rejected (most visibly in local development on
 * `localhost:5173`). Requests go to the same-origin proxy `GET
 * /api/wallpaper/bing`, which reads the upstream JSON on the server and returns
 * just the image URL.
 */

/** Same-origin endpoint that proxies the Bing daily image API. */
const BING_WALLPAPER_PROXY = '/api/wallpaper/bing'

const REQUEST_TIMEOUT_MS = 15_000

/**
 * Resolves today's Bing wallpaper image URL.
 *
 * `endpoint` is the upstream API URL configured in the admin panel (for
 * example `https://api.bimg.cc/today`). It is forwarded to the proxy as a
 * query parameter; an empty value uses the proxy's default.
 *
 * Returns `null` when the lookup fails, so callers fall back to a preset.
 */
export async function fetchBingWallpaperUrl(endpoint: string): Promise<string | null> {
  const target = endpoint.trim()
  const url = new URL(BING_WALLPAPER_PROXY, window.location.origin)
  if (target) url.searchParams.set('url', target)

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    })
    if (!response.ok) return null
    const payload = (await response.json()) as { url?: unknown }
    return typeof payload.url === 'string' && /^https?:\/\//i.test(payload.url)
      ? payload.url
      : null
  } catch {
    return null
  } finally {
    window.clearTimeout(timer)
  }
}
