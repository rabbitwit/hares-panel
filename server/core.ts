/**
 * Runtime-agnostic API core shared by the Cloudflare Worker and the Vercel
 * functions. It only relies on Web standard APIs (Request / Response / crypto),
 * so the same code runs on Workers, Node 20+ and the test harness.
 */

import {
  compareVersions,
  getLatestRelease,
  normalizeVersion,
  type LatestRelease,
} from './update'

export interface StoredState {
  data: unknown
  updatedAt: number
}

export interface StateStore {
  kind: 'kv' | 'd1' | 'redis' | 'edgeone-blob' | 'file'
  getState(): Promise<StoredState | null>
  putState(data: unknown): Promise<number>
}

export interface StoredAsset {
  bytes: Uint8Array<ArrayBuffer>
  contentType: string
}

export interface AssetStore {
  kind: 'r2' | 'blob' | 'edgeone-blob' | 'file'
  putAsset(
    key: string,
    bytes: Uint8Array<ArrayBuffer>,
    contentType: string,
  ): Promise<{ key: string; url: string }>
  getAsset(key: string): Promise<StoredAsset | null>
  deleteAsset(key: string, url?: string): Promise<void>
}

export interface ApiConfig {
  adminPassword: string
  sessionSecret?: string
  state: StateStore | null
  assets: AssetStore | null
  stateMaxBytes?: number
  assetMaxBytes?: number
  tokenTtlMs?: number
  /** Actual runtime serving the API, e.g. `cloudflare-workers` / `vercel`. */
  runtime?: string
  /** Extra platform detail, e.g. `Cloudflare-Workers` or `v22.14.0`. */
  platform?: string
  /** Injectable version lookup for tests and private mirrors. */
  updateChecker?: (options: { force?: boolean }) => Promise<LatestRelease>
}

const DEFAULT_STATE_MAX_BYTES = 8 * 1024 * 1024
const DEFAULT_ASSET_MAX_BYTES = 6 * 1024 * 1024
const DEFAULT_TOKEN_TTL = 7 * 24 * 60 * 60 * 1000
const ALLOWED_IMAGE_TYPES = new Map<string, string>([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
  ['image/svg+xml', 'svg'],
  ['image/avif', 'avif'],
  ['image/x-icon', 'ico'],
  ['image/vnd.microsoft.icon', 'ico'],
])

const encoder = new TextEncoder()

async function readJsonLimited(
  request: Request,
  maxBytes: number,
): Promise<{ ok: true; value: unknown } | { ok: false; tooLarge: boolean }> {
  const declared = Number(request.headers.get('content-length') || '0')
  if (declared > maxBytes) return { ok: false, tooLarge: true }
  if (!request.body) return { ok: true, value: null }
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel()
        return { ok: false, tooLarge: true }
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(merged)) }
  } catch {
    return { ok: false, tooLarge: false }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
  })
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

async function sha256(value: string): Promise<Uint8Array<ArrayBuffer>> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value))
  return new Uint8Array(digest)
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false
  let diff = 0
  for (let index = 0; index < left.length; index += 1) diff |= left[index] ^ right[index]
  return diff === 0
}

export async function safePasswordEqual(input: string, expected: string): Promise<boolean> {
  const [left, right] = await Promise.all([sha256(input), sha256(expected)])
  return bytesEqual(left, right)
}

function tokenSecret(config: ApiConfig): string {
  return config.sessionSecret?.trim() || `hares-nav:${config.adminPassword}`
}

async function hmacKey(secret: string, usage: 'sign' | 'verify'): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [usage],
  )
}

export async function createToken(
  config: ApiConfig,
): Promise<{ token: string; expiresAt: number }> {
  const ttl = config.tokenTtlMs ?? DEFAULT_TOKEN_TTL
  const now = Date.now()
  const expiresAt = now + ttl
  const payload = toBase64Url(
    encoder.encode(JSON.stringify({ sub: 'cloud-admin', iat: now, exp: expiresAt })),
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    await hmacKey(tokenSecret(config), 'sign'),
    encoder.encode(payload),
  )
  return { token: `${payload}.${toBase64Url(new Uint8Array(signature))}`, expiresAt }
}

export async function verifyToken(token: string, config: ApiConfig): Promise<boolean> {
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return false
  try {
    const valid = await crypto.subtle.verify(
      'HMAC',
      await hmacKey(tokenSecret(config), 'verify'),
      fromBase64Url(signature),
      encoder.encode(payload),
    )
    if (!valid) return false
    const decoded = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as {
      sub?: string
      exp?: number
    }
    return decoded.sub === 'cloud-admin' && typeof decoded.exp === 'number' && decoded.exp > Date.now()
  } catch {
    return false
  }
}

function bearerToken(request: Request): string {
  const header = request.headers.get('authorization') ?? ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() ?? ''
}

async function requireAuth(request: Request, config: ApiConfig): Promise<Response | null> {
  const token = bearerToken(request)
  if (!token || !(await verifyToken(token, config))) {
    return json(401, { error: 'unauthorized', message: '登录状态无效或已过期' })
  }
  return null
}

export function isAppData(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value) || !isRecord(value.config)) return false
  return ['groups', 'items', 'searchEngines', 'gallery'].every((key) =>
    Array.isArray(value[key]),
  )
}

/** Keeps only the five persisted sections; legacy `users`, announcement and window-mode fields are dropped. */
export function sanitizeState(value: unknown): Record<string, unknown> | null {
  if (!isAppData(value)) return null
  const config = { ...(value.config as Record<string, unknown>) }
  delete config.showAnnouncement
  delete config.announcementText
  config.defaultOpenMode = config.defaultOpenMode === 'self' ? 'self' : 'new'
  const items = (value.items as unknown[]).map((item) => {
    if (!isRecord(item)) return item
    const next = { ...item }
    delete next.windowWidth
    delete next.windowHeight
    next.openMode = next.openMode === 'self' ? 'self' : 'new'
    return next
  })
  return {
    config,
    groups: value.groups,
    items,
    searchEngines: value.searchEngines,
    gallery: value.gallery,
  }
}

export function publicState(
  data: unknown,
  options: { locked?: boolean } = {},
): Record<string, unknown> | null {
  const state = sanitizeState(data)
  if (!state) return null
  // The profile belongs to the administrator account and is only returned by
  // the authenticated `?full=1` endpoint. Public visits still get the rest of
  // the config (theme, site name, logo, ...) for rendering.
  const publicConfig = { ...(state.config as Record<string, unknown>) }
  delete publicConfig.adminName
  delete publicConfig.adminAvatar
  if (options.locked) {
    // Public access is disabled: only expose the configuration needed for the
    // login screen (theme, name, logo, ...) and hide all navigation content.
    return {
      config: publicConfig,
      groups: [],
      items: [],
      searchEngines: [],
      gallery: [],
      locked: true,
    }
  }

  // Visitors must never receive hidden cards/groups, even though the admin
  // full-state endpoint still needs them. The browser already filters these
  // for rendering, but the public JSON itself must not contain the data.
  const groups = Array.isArray(state.groups) ? state.groups : []
  const items = Array.isArray(state.items) ? state.items : []
  const visibleGroups = groups.filter(
    (group) => isRecord(group) && !group.hidden,
  )
  const visibleGroupIds = new Set(
    visibleGroups
      .map((group) => (isRecord(group) && typeof group.id === 'string' ? group.id : null))
      .filter((id): id is string => Boolean(id)),
  )
  return {
    ...state,
    config: publicConfig,
    groups: visibleGroups,
    items: items.filter(
      (item) =>
        isRecord(item) &&
        !item.hidden &&
        typeof item.groupId === 'string' &&
        visibleGroupIds.has(item.groupId),
    ),
  }
}

function requestIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  )
}

const loginAttempts = new Map<string, { count: number; resetAt: number }>()
const LOGIN_WINDOW_MS = 60_000
const LOGIN_MAX_ATTEMPTS = 8

function tooManyAttempts(ip: string): boolean {
  const now = Date.now()
  if (loginAttempts.size > 5000) {
    for (const [key, record] of loginAttempts) {
      if (record.resetAt <= now) loginAttempts.delete(key)
    }
  }
  const record = loginAttempts.get(ip)
  if (!record || record.resetAt <= now) {
    loginAttempts.set(ip, { count: 0, resetAt: now + LOGIN_WINDOW_MS })
    return false
  }
  return record.count >= LOGIN_MAX_ATTEMPTS
}

function recordFailedAttempt(ip: string) {
  const now = Date.now()
  const record = loginAttempts.get(ip)
  if (!record || record.resetAt <= now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS })
    return
  }
  record.count += 1
}

function clearAttempts(ip: string) {
  loginAttempts.delete(ip)
}

function assetKey(value: string): string | null {
  let key: string
  try {
    key = decodeURIComponent(value)
  } catch {
    return null
  }
  if (!key || key.length > 200 || key.startsWith('/') || key.includes('\\') || key.includes('..')) {
    return null
  }
  // Blob stores prefix keys with a slash (`hares-panel/asset-...`).
  return /^[a-zA-Z0-9._/-]+$/.test(key) ? key : null
}

function contentTypeFromKey(key: string): string {
  const extension = key.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    avif: 'image/avif',
    ico: 'image/x-icon',
  }
  return map[extension] ?? 'application/octet-stream'
}

function healthBody(config: ApiConfig, ok: boolean, storageError?: string) {
  return {
    app: 'hares-panel',
    version: 1,
    ok,
    runtime: config.runtime ?? null,
    platform: config.platform ?? null,
    storage: config.state?.kind ?? null,
    assets: config.assets?.kind ?? null,
    auth: Boolean(config.adminPassword),
    limits: {
      stateBytes: config.stateMaxBytes ?? DEFAULT_STATE_MAX_BYTES,
      assetBytes: config.assetMaxBytes ?? DEFAULT_ASSET_MAX_BYTES,
    },
    ...(storageError ? { storageError } : {}),
  }
}

async function handleHealth(config: ApiConfig): Promise<Response> {
  if (!config.state) {
    return json(200, healthBody(config, false))
  }
  try {
    await config.state.getState()
    return json(200, healthBody(config, true))
  } catch {
    return json(200, healthBody(config, false, 'storage_unavailable'))
  }
}

async function handleUpdate(config: ApiConfig, url: URL): Promise<Response> {
  const requested = url.searchParams.get('current')?.trim() ?? ''
  const currentVersion = requested ? normalizeVersion(requested) : null
  const force = url.searchParams.get('force') === '1'
  const updateChecker = config.updateChecker ?? getLatestRelease

  let latest: LatestRelease
  try {
    latest = await updateChecker({ force })
  } catch (error) {
    console.error('[hares-panel] update check failed', error)
    return json(502, {
      error: 'update_check_failed',
      message: '无法检查更新，请确认服务器可以访问 Docker Hub / GitHub 后重试',
    })
  }

  return json(200, {
    currentVersion,
    latestVersion: latest.latestVersion,
    latestTag: latest.latestTag,
    image: latest.image,
    source: latest.source,
    publishedAt: latest.publishedAt,
    checkedAt: latest.checkedAt,
    updateAvailable: currentVersion
      ? compareVersions(latest.latestVersion, currentVersion) > 0
      : null,
  })
}

async function handleLogin(request: Request, config: ApiConfig): Promise<Response> {
  if (!config.state) {
    return json(503, { error: 'not_configured', message: '云端存储尚未配置' })
  }
  if (!config.adminPassword) {
    return json(503, { error: 'no_password', message: '尚未设置 ADMIN_PASSWORD 环境变量' })
  }
  const ip = requestIp(request)
  if (tooManyAttempts(ip)) {
    return json(429, { error: 'rate_limited', message: '尝试次数过多，请稍后再试' })
  }
  let password = ''
  const parsed = await readJsonLimited(request, 16 * 1024)
  if (!parsed.ok) {
    return parsed.tooLarge
      ? json(413, { error: 'too_large', message: '请求内容过大' })
      : json(400, { error: 'bad_request', message: '请求格式不正确' })
  }
  const body = parsed.value as { password?: unknown } | null
  password = typeof body?.password === 'string' ? body.password : ''
  if (!password || !(await safePasswordEqual(password, config.adminPassword))) {
    recordFailedAttempt(ip)
    return json(401, { error: 'invalid_password', message: '管理员密码不正确' })
  }
  clearAttempts(ip)
  const session = await createToken(config)
  return json(200, { ...session, storage: config.state.kind, assets: config.assets?.kind ?? null })
}

async function handleSessionRefresh(request: Request, config: ApiConfig): Promise<Response> {
  const unauthorized = await requireAuth(request, config)
  if (unauthorized) return unauthorized
  const session = await createToken(config)
  return json(200, session)
}

async function handleState(request: Request, config: ApiConfig, url: URL): Promise<Response> {
  if (!config.state) {
    return json(503, { error: 'not_configured', message: '云端存储尚未配置' })
  }
  if (request.method === 'GET') {
    const full = url.searchParams.get('full') === '1'
    if (full) {
      const unauthorized = await requireAuth(request, config)
      if (unauthorized) return unauthorized
    }
    let stored: StoredState | null
    try {
      stored = await config.state.getState()
    } catch {
      return json(503, { error: 'storage_unavailable', message: '云端存储暂时不可用' })
    }
    if (!stored) return json(404, { error: 'empty', message: '服务端还没有数据' })
    if (full) {
      const data = sanitizeState(stored.data)
      if (!data) return json(500, { error: 'invalid_state', message: '服务端数据格式不正确' })
      return json(200, { data, updatedAt: stored.updatedAt })
    }
    const storedConfig = isRecord(stored.data) && isRecord(stored.data.config) ? stored.data.config : null
    const locked = storedConfig?.publicAccess === false
    const data = publicState(stored.data, { locked })
    if (!data) return json(500, { error: 'invalid_state', message: '服务端数据格式不正确' })
    return json(200, { data, updatedAt: stored.updatedAt, public: true, locked })
  }

  if (request.method === 'PUT') {
    const unauthorized = await requireAuth(request, config)
    if (unauthorized) return unauthorized
    const max = config.stateMaxBytes ?? DEFAULT_STATE_MAX_BYTES
    const parsed = await readJsonLimited(request, max)
    if (!parsed.ok) {
      return parsed.tooLarge
        ? json(413, { error: 'too_large', message: '导航数据超过大小限制' })
        : json(400, { error: 'bad_request', message: '请求格式不正确' })
    }
    const body = parsed.value as { data?: unknown } | null
    const data = sanitizeState(body?.data)
    if (!data) {
      return json(400, { error: 'invalid_state', message: '导航数据格式不正确' })
    }
    const serialized = JSON.stringify(data)
    if (serialized.length > max) {
      return json(413, { error: 'too_large', message: '导航数据超过大小限制' })
    }
    try {
      const updatedAt = await config.state.putState(data)
      return json(200, { updatedAt })
    } catch {
      return json(503, { error: 'storage_unavailable', message: '写入云端存储失败' })
    }
  }

  return json(405, { error: 'method_not_allowed' })
}

async function handleAssets(request: Request, config: ApiConfig, url: URL): Promise<Response> {
  if (!config.assets) {
    return json(503, { error: 'not_configured', message: '图床尚未配置' })
  }

  const rest = url.pathname.replace(/^\/api\/assets\/?/, '')

  if (!rest) {
    if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' })
    const unauthorized = await requireAuth(request, config)
    if (unauthorized) return unauthorized
    let form: FormData
    try {
      form = await request.formData()
    } catch {
      return json(400, { error: 'bad_request', message: '无法读取上传内容' })
    }
    const file = form.get('file')
    if (!(file instanceof Blob) || typeof file.size !== 'number') {
      return json(400, { error: 'missing_file', message: '请选择要上传的图片' })
    }
    const contentType = (file.type || 'application/octet-stream').toLowerCase()
    const extension = ALLOWED_IMAGE_TYPES.get(contentType)
    if (!extension) {
      return json(415, { error: 'unsupported_type', message: '仅支持 PNG / JPEG / WebP / GIF / SVG / AVIF / ICO' })
    }
    const max = config.assetMaxBytes ?? DEFAULT_ASSET_MAX_BYTES
    if (file.size > max) {
      return json(413, { error: 'too_large', message: `图片不能超过 ${Math.round(max / 1024 / 1024)} MB` })
    }
    const key = `asset-${crypto.randomUUID().replaceAll('-', '')}.${extension}`
    const bytes = new Uint8Array(await file.arrayBuffer())
    try {
      const stored = await config.assets.putAsset(key, bytes, contentType)
      return json(
        201,
        { key: stored.key, url: stored.url, size: bytes.byteLength, contentType },
      )
    } catch {
      return json(503, { error: 'asset_store_unavailable', message: '上传图片失败' })
    }
  }

  const key = assetKey(rest)
  if (!key) return json(400, { error: 'bad_key', message: '图片标识不正确' })

  if (request.method === 'GET' || request.method === 'HEAD') {
    try {
      const asset = await config.assets.getAsset(key)
      if (!asset) return json(404, { error: 'not_found' })
      return new Response(request.method === 'HEAD' ? null : asset.bytes, {
        status: 200,
        headers: {
          'content-type': asset.contentType || contentTypeFromKey(key),
          'content-length': String(asset.bytes.byteLength),
          'cache-control': 'public, max-age=31536000, immutable',
        },
      })
    } catch {
      return json(503, { error: 'asset_store_unavailable' })
    }
  }

  if (request.method === 'DELETE') {
    const unauthorized = await requireAuth(request, config)
    if (unauthorized) return unauthorized
    let publicUrl: string | undefined
    try {
      const body = (await request.json()) as { url?: unknown }
      publicUrl = typeof body.url === 'string' ? body.url : undefined
    } catch {
      publicUrl = undefined
    }
    try {
      await config.assets.deleteAsset(key, publicUrl)
      return json(200, { ok: true })
    } catch {
      return json(503, { error: 'asset_store_unavailable', message: '删除图片失败' })
    }
  }

  return json(405, { error: 'method_not_allowed' })
}

export async function handleApi(request: Request, config: ApiConfig): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname.replace(/\/+$/, '') || '/'

  try {
    if (path === '/api/health') {
      if (request.method !== 'GET') return json(405, { error: 'method_not_allowed' })
      return await handleHealth(config)
    }
    if (path === '/api/update') {
      if (request.method !== 'GET') return json(405, { error: 'method_not_allowed' })
      return await handleUpdate(config, url)
    }
    if (path === '/api/login') {
      if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' })
      return await handleLogin(request, config)
    }
    if (path === '/api/session/refresh') {
      if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' })
      return await handleSessionRefresh(request, config)
    }
    if (path === '/api/state') {
      return await handleState(request, config, url)
    }
    if (path === '/api/assets' || path.startsWith('/api/assets/')) {
      return await handleAssets(request, config, url)
    }
    return json(404, { error: 'not_found' })
  } catch (error) {
    console.error('[hares-nav] API error', error)
    return json(500, { error: 'internal_error', message: '服务器处理请求时出错' })
  }
}
