/**
 * Cross-instance sync.
 *
 * One Hares-Panel instance (the initiator) logs into another instance (the
 * target) over the public API, compares the two state documents and copies the
 * newer one when needed. Running this on the server avoids browser CORS
 * restrictions and lets Docker / Workers / Vercel / EdgeOne all initiate sync
 * with the same code.
 */

import type { ApiConfig } from './core'

export type SyncMode = 'auto' | 'upload' | 'download'
export type SyncDirection = 'upload' | 'download' | 'none'
export type SyncAction = 'sync' | 'test'

type JsonRecord = Record<string, unknown>

interface SyncGalleryAsset {
  id: string
  name?: string
  category?: string
  dataUrl: string
  size?: number
  createdAt?: number
  remoteKey?: string
}

interface SyncAppData {
  config: JsonRecord
  groups: JsonRecord[]
  items: JsonRecord[]
  searchEngines: JsonRecord[]
  gallery: SyncGalleryAsset[]
}

interface RemoteState {
  data: SyncAppData
  updatedAt: number
}

interface RemoteConnection {
  base: string
  token: string
  health: JsonRecord
  origin: string
}

interface AssetTransferSummary {
  enabled: boolean
  total: number
  transferred: number
  existing: number
  failed: number
  warnings: string[]
}

interface SyncOptions {
  localOrigin?: string
  fetchImpl?: typeof fetch
}

export interface SyncRemoteSummary {
  app: string
  version: number | null
  ok: boolean
  runtime: string | null
  storage: string | null
  assets: string | null
  limits: { stateBytes: number; assetBytes: number } | null
}

export interface SyncResult {
  ok: true
  action: SyncAction
  mode: SyncMode
  direction: SyncDirection
  localUpdatedAt: number | null
  remoteUpdatedAt: number | null
  updatedAt: number | null
  remote: SyncRemoteSummary
  empty?: boolean
  assets?: AssetTransferSummary
  warnings?: string[]
  data?: SyncAppData
}

export class SyncError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'SyncError'
    this.status = status
    this.code = code
  }
}

const REQUEST_TIMEOUT_MS = 20_000
const ASSET_TIMEOUT_MS = 60_000
const MAX_REMOTE_STATE_BYTES = 32 * 1024 * 1024
const DEFAULT_STATE_MAX_BYTES = 8 * 1024 * 1024
const DEFAULT_ASSET_MAX_BYTES = 6 * 1024 * 1024
const MAX_WARNINGS = 5

const IMAGE_TYPES = new Map<string, string>([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
  ['image/svg+xml', 'svg'],
  ['image/avif', 'avif'],
  ['image/x-icon', 'ico'],
  ['image/vnd.microsoft.icon', 'ico'],
])

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSyncData(value: unknown): value is SyncAppData {
  if (!isRecord(value) || !isRecord(value.config)) return false
  return ['groups', 'items', 'searchEngines', 'gallery'].every((key) =>
    Array.isArray(value[key]),
  )
}

function cloneData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeMode(value: unknown): SyncMode {
  return value === 'upload' || value === 'download' ? value : 'auto'
}

function normalizeRemoteBase(value: string): string {
  let text = value.trim()
  if (!text) throw new SyncError(400, 'remote_url_required', '请输入远端地址')
  if (!/^https?:\/\//i.test(text)) text = `https://${text}`

  let url: URL
  try {
    url = new URL(text)
  } catch {
    throw new SyncError(400, 'bad_remote_url', '远端地址格式不正确')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SyncError(400, 'bad_remote_url', '远端地址只支持 http 或 https')
  }
  if (url.username || url.password) {
    throw new SyncError(400, 'bad_remote_url', '远端地址不能包含用户名或密码')
  }
  url.hash = ''
  url.search = ''
  let pathname = url.pathname.replace(/\/+$/, '')
  if (pathname.toLowerCase().endsWith('/api')) pathname = pathname.slice(0, -4)
  return `${url.origin}${pathname}`
}

function remoteSummary(health: JsonRecord): SyncRemoteSummary {
  const limits = isRecord(health.limits) ? health.limits : null
  return {
    app: typeof health.app === 'string' ? health.app : 'hares-panel',
    version: typeof health.version === 'number' ? health.version : null,
    ok: health.ok === true,
    runtime: typeof health.runtime === 'string' ? health.runtime : null,
    storage: typeof health.storage === 'string' ? health.storage : null,
    assets: typeof health.assets === 'string' ? health.assets : null,
    limits: limits
      ? {
          stateBytes:
            typeof limits.stateBytes === 'number'
              ? limits.stateBytes
              : DEFAULT_STATE_MAX_BYTES,
          assetBytes:
            typeof limits.assetBytes === 'number'
              ? limits.assetBytes
              : DEFAULT_ASSET_MAX_BYTES,
        }
      : null,
  }
}

function contentTypeExtension(contentType: string): string | null {
  return IMAGE_TYPES.get(contentType.toLowerCase().split(';')[0].trim()) ?? null
}

function contentTypeFromKey(key: string): string {
  const extension = key.split('.').pop()?.toLowerCase() ?? ''
  for (const [type, ext] of IMAGE_TYPES) {
    if (ext === extension || (extension === 'jpeg' && ext === 'jpg')) return type
  }
  return 'application/octet-stream'
}

function normalizeContentType(value: string, key: string): string {
  const type = value.toLowerCase().split(';')[0].trim()
  if (contentTypeExtension(type)) return type
  return contentTypeFromKey(key)
}

function stripAssetPrefix(key: string): string {
  return key.replace(/^hares-panel\//i, '')
}

function safeAssetKey(key: string): string | null {
  if (!key || key.length > 200 || key.startsWith('/') || key.includes('\\') || key.includes('..')) {
    return null
  }
  return /^[a-zA-Z0-9._/-]+$/.test(key) ? key : null
}

function pickAssetKey(
  asset: SyncGalleryAsset,
  contentType: string,
  used: Set<string>,
): string {
  const extension = contentTypeExtension(contentType) ?? 'png'
  let key = readString(asset.remoteKey)
  if (!key && asset.dataUrl) {
    try {
      const pathname = new URL(asset.dataUrl, 'https://placeholder.local/').pathname
      key = decodeURIComponent(pathname.split('/').pop() ?? '')
    } catch {
      key = ''
    }
  }
  key = stripAssetPrefix(key)
  if (!safeAssetKey(key)) key = ''
  if (key && !/\.[a-z0-9]{2,5}$/i.test(key)) key = `${key}.${extension}`

  const unique = (candidate: string) => {
    if (!used.has(candidate)) return candidate
    const dot = candidate.lastIndexOf('.')
    const stem = dot > 0 ? candidate.slice(0, dot) : candidate
    const ext = dot > 0 ? candidate.slice(dot) : ''
    return `${stem}-${crypto.randomUUID().slice(0, 8)}${ext}`
  }

  const finalKey = unique(key || `asset-${crypto.randomUUID().replaceAll('-', '')}.${extension}`)
  used.add(finalKey)
  return finalKey
}

function absoluteUrl(value: string, base: string): string {
  if (!value) return ''
  if (/^(https?:|data:|blob:)/i.test(value)) return value
  if (!base) return value
  try {
    return new URL(value, base.endsWith('/') ? base : `${base}/`).toString()
  } catch {
    return value
  }
}

function comparableData(data: SyncAppData): string {
  const copy = cloneData(data)
  copy.gallery = copy.gallery.map((asset) => {
    const { dataUrl: _dataUrl, remoteKey: _remoteKey, ...rest } = asset
    return rest as SyncGalleryAsset
  })
  return JSON.stringify(copy)
}

async function readResponseBytes(
  response: Response,
  maxBytes: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const declared = Number(response.headers.get('content-length') || '0')
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new SyncError(413, 'too_large', '远端返回的数据超过大小限制')
  }
  if (!response.body) return new Uint8Array(0)

  const reader = response.body.getReader()
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
        throw new SyncError(413, 'too_large', '远端返回的数据超过大小限制')
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
  return merged
}

async function readResponseJson<T>(
  response: Response,
  maxBytes = 256 * 1024,
): Promise<T> {
  const bytes = await readResponseBytes(response, maxBytes)
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as T
  } catch {
    throw new SyncError(502, 'bad_remote_response', '远端返回了无法识别的数据')
  }
}

async function readRemoteError(response: Response): Promise<string> {
  try {
    const payload = await readResponseJson<{ message?: unknown; error?: unknown }>(response)
    if (typeof payload.message === 'string' && payload.message.trim()) {
      return payload.message.trim()
    }
    if (typeof payload.error === 'string' && payload.error.trim()) return payload.error
  } catch {
    // Use the status-based fallback below.
  }
  return `远端请求失败（${response.status}）`
}

async function remoteFetch(
  options: SyncOptions,
  url: string,
  init: RequestInit = {},
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const fetcher = options.fetchImpl ?? fetch
  try {
    return await fetcher(url, {
      ...init,
      redirect: init.redirect ?? 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    if (error instanceof SyncError) throw error
    throw new SyncError(
      502,
      'remote_unreachable',
      '无法连接远端实例，请检查地址、网络或 HTTPS 反向代理',
    )
  }
}

async function connectRemote(
  options: SyncOptions,
  remoteUrl: string,
  password: string,
): Promise<RemoteConnection> {
  const base = normalizeRemoteBase(remoteUrl)
  const origin = new URL(base).origin

  const healthResponse = await remoteFetch(options, `${base}/api/health`, {
    headers: { accept: 'application/json' },
  })
  if (!healthResponse.ok) {
    throw new SyncError(
      502,
      'remote_health_failed',
      `远端健康检查失败：${await readRemoteError(healthResponse)}`,
    )
  }
  const health = await readResponseJson<JsonRecord>(healthResponse)
  if (health.app && health.app !== 'hares-panel') {
    throw new SyncError(400, 'remote_not_hares', '远端地址不是 Hares-Panel 实例')
  }
  if (health.ok === false) {
    throw new SyncError(502, 'remote_storage_unavailable', '远端服务端存储暂时不可用')
  }
  if (!health.storage) {
    throw new SyncError(502, 'remote_storage_missing', '远端尚未配置 KV / D1 / Redis / Blob 存储')
  }
  if (health.auth === false) {
    throw new SyncError(502, 'remote_no_password', '远端尚未设置 ADMIN_PASSWORD')
  }

  const loginResponse = await remoteFetch(options, `${base}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ password }),
  })
  if (!loginResponse.ok) {
    if (loginResponse.status === 401) {
      throw new SyncError(401, 'remote_auth_failed', '远端管理员密码不正确')
    }
    if (loginResponse.status === 429) {
      throw new SyncError(429, 'remote_rate_limited', '远端登录尝试过于频繁，请稍后再试')
    }
    throw new SyncError(
      502,
      'remote_login_failed',
      `远端登录失败：${await readRemoteError(loginResponse)}`,
    )
  }
  const session = await readResponseJson<{ token?: unknown }>(loginResponse)
  if (typeof session.token !== 'string' || !session.token) {
    throw new SyncError(502, 'remote_login_failed', '远端登录失败：未返回登录令牌')
  }

  return { base, token: session.token, health, origin }
}

async function readRemoteState(
  options: SyncOptions,
  remote: RemoteConnection,
): Promise<RemoteState | null> {
  const response = await remoteFetch(options, `${remote.base}/api/state?full=1`, {
    headers: {
      authorization: `Bearer ${remote.token}`,
      accept: 'application/json',
    },
  })
  if (response.status === 404) return null
  if (!response.ok) {
    throw new SyncError(
      502,
      'remote_state_failed',
      `读取远端数据失败：${await readRemoteError(response)}`,
    )
  }
  const payload = await readResponseJson<{ data?: unknown; updatedAt?: unknown }>(
    response,
    MAX_REMOTE_STATE_BYTES,
  )
  if (!isSyncData(payload.data)) {
    throw new SyncError(502, 'remote_bad_state', '远端导航数据格式不正确')
  }
  return {
    data: payload.data,
    updatedAt:
      typeof payload.updatedAt === 'number' && Number.isFinite(payload.updatedAt)
        ? payload.updatedAt
        : Date.now(),
  }
}

async function readLocalState(config: ApiConfig): Promise<RemoteState | null> {
  if (!config.state) {
    throw new SyncError(503, 'local_storage_unavailable', '本机服务端存储尚未配置')
  }
  let stored
  try {
    stored = await config.state.getState()
  } catch {
    throw new SyncError(503, 'local_storage_unavailable', '读取本机服务端数据失败')
  }
  if (!stored) return null
  if (!isSyncData(stored.data)) {
    throw new SyncError(500, 'local_bad_state', '本机服务端数据格式不正确')
  }
  return { data: stored.data, updatedAt: stored.updatedAt }
}

/**
 * Parses a data URL without relying on FileReader (not available in Workers).
 */
function decodeDataUrl(value: string): { bytes: Uint8Array<ArrayBuffer>; contentType: string } | null {
  if (!value.startsWith('data:')) return null
  const comma = value.indexOf(',')
  if (comma < 0) return null
  const meta = value.slice(5, comma)
  const payload = value.slice(comma + 1)
  const mime = meta.match(/^([^;]+)/)?.[1] || 'application/octet-stream'
  try {
    if (/;base64/i.test(meta)) {
      const binary = atob(payload)
      const bytes = new Uint8Array(binary.length)
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index)
      }
      return { bytes, contentType: mime }
    }
    return {
      bytes: new TextEncoder().encode(decodeURIComponent(payload)),
      contentType: mime,
    }
  } catch {
    return null
  }
}

async function fetchAssetBytes(
  options: SyncOptions,
  url: string,
  maxBytes: number,
): Promise<{ bytes: Uint8Array<ArrayBuffer>; contentType: string }> {
  const response = await remoteFetch(options, url, { headers: { accept: 'image/*' } }, ASSET_TIMEOUT_MS)
  if (!response.ok) {
    throw new SyncError(
      response.status === 404 ? 404 : 502,
      'remote_asset_failed',
      `读取远端图片失败（${response.status}）`,
    )
  }
  const bytes = await readResponseBytes(response, maxBytes)
  return {
    bytes,
    contentType: normalizeContentType(response.headers.get('content-type') || '', url),
  }
}

async function readLocalAssetBytes(
  config: ApiConfig,
  asset: SyncGalleryAsset,
  options: SyncOptions,
): Promise<{ bytes: Uint8Array<ArrayBuffer>; contentType: string }> {
  if (config.assets && asset.remoteKey) {
    const keys = [...new Set([asset.remoteKey, stripAssetPrefix(asset.remoteKey)])]
    for (const key of keys) {
      try {
        const stored = await config.assets.getAsset(key)
        if (stored) {
          return {
            bytes: stored.bytes,
            contentType: normalizeContentType(stored.contentType, key),
          }
        }
      } catch {
        // Try the next key / URL fallback.
      }
    }
  }

  const decoded = decodeDataUrl(asset.dataUrl)
  if (decoded) return decoded

  const url = absoluteUrl(asset.dataUrl, options.localOrigin ?? '')
  if (/^https?:\/\//i.test(url)) {
    const max = config.assetMaxBytes ?? DEFAULT_ASSET_MAX_BYTES
    return await fetchAssetBytes(options, url, max)
  }
  throw new SyncError(404, 'asset_missing', '本机缺少图片对象')
}

async function readRemoteAssetBytes(
  options: SyncOptions,
  remote: RemoteConnection,
  asset: SyncGalleryAsset,
  maxBytes: number,
): Promise<{ bytes: Uint8Array<ArrayBuffer>; contentType: string }> {
  const decoded = decodeDataUrl(asset.dataUrl)
  if (decoded) return decoded

  const candidates: string[] = []
  if (/^https?:\/\//i.test(asset.dataUrl)) candidates.push(asset.dataUrl)
  if (asset.remoteKey) {
    candidates.push(`${remote.base}/api/assets/${encodeURIComponent(asset.remoteKey)}`)
  }
  if (asset.dataUrl) {
    const resolved = absoluteUrl(asset.dataUrl, remote.base)
    if (/^https?:\/\//i.test(resolved) && !candidates.includes(resolved)) {
      candidates.push(resolved)
    }
  }

  let lastError: unknown = null
  for (const url of candidates) {
    try {
      return await fetchAssetBytes(options, url, maxBytes)
    } catch (error) {
      lastError = error
    }
  }
  if (lastError instanceof SyncError) throw lastError
  throw new SyncError(404, 'remote_asset_missing', '远端缺少图片对象')
}

async function uploadRemoteAsset(
  options: SyncOptions,
  remote: RemoteConnection,
  key: string,
  bytes: Uint8Array<ArrayBuffer>,
  contentType: string,
): Promise<{ key: string; url: string }> {
  const response = await remoteFetch(
    options,
    `${remote.base}/api/assets/${encodeURIComponent(key)}`,
    {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${remote.token}`,
        'content-type': contentType,
      },
      body: bytes,
    },
    ASSET_TIMEOUT_MS,
  )

  if (response.status === 404 || response.status === 405) {
    // Older instances do not have the raw PUT import route; fall back to the
    // multipart upload API. The generated key may differ, which is fine.
    const form = new FormData()
    form.append('file', new Blob([bytes], { type: contentType }), key)
    const fallback = await remoteFetch(
      options,
      `${remote.base}/api/assets`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${remote.token}` },
        body: form,
      },
      ASSET_TIMEOUT_MS,
    )
    if (!fallback.ok) {
      throw new SyncError(
        502,
        'remote_asset_upload_failed',
        `上传远端图片失败：${await readRemoteError(fallback)}`,
      )
    }
    const uploaded = await readResponseJson<{ key?: unknown; url?: unknown }>(fallback)
    if (typeof uploaded.key !== 'string' || typeof uploaded.url !== 'string') {
      throw new SyncError(502, 'remote_asset_upload_failed', '远端没有返回图片地址')
    }
    return { key: uploaded.key, url: uploaded.url }
  }

  if (!response.ok) {
    throw new SyncError(
      502,
      'remote_asset_upload_failed',
      `上传远端图片失败：${await readRemoteError(response)}`,
    )
  }
  const uploaded = await readResponseJson<{ key?: unknown; url?: unknown }>(response)
  if (typeof uploaded.key !== 'string' || typeof uploaded.url !== 'string') {
    throw new SyncError(502, 'remote_asset_upload_failed', '远端没有返回图片地址')
  }
  return { key: uploaded.key, url: uploaded.url }
}

function assetReference(asset: SyncGalleryAsset | undefined): boolean {
  return Boolean(asset && (asset.dataUrl || asset.remoteKey))
}

function addWarning(summary: AssetTransferSummary, message: string): void {
  if (summary.warnings.length < MAX_WARNINGS) summary.warnings.push(message)
}

async function localAssetExists(
  config: ApiConfig,
  asset: SyncGalleryAsset,
): Promise<boolean> {
  if (!config.assets) return false
  const keys = asset.remoteKey
    ? [...new Set([asset.remoteKey, stripAssetPrefix(asset.remoteKey)])]
    : []
  for (const key of keys) {
    try {
      if (await config.assets.getAsset(key)) return true
    } catch {
      // Try the next key.
    }
  }
  if (asset.dataUrl.startsWith('data:')) return true
  // Vercel Blob objects are served from the CDN and cannot be read through the
  // asset store API, so an absolute URL means the object already exists.
  if (config.assets.kind === 'blob' && /^https?:\/\//i.test(asset.dataUrl)) return true
  return false
}

async function syncAssetsForUpload(
  config: ApiConfig,
  localData: SyncAppData,
  remoteState: RemoteState | null,
  remote: RemoteConnection,
  options: SyncOptions,
  includeAssets: boolean,
  targetData: SyncAppData,
): Promise<AssetTransferSummary> {
  const summary: AssetTransferSummary = {
    enabled: includeAssets,
    total: localData.gallery.length,
    transferred: 0,
    existing: 0,
    failed: 0,
    warnings: [],
  }
  const remoteById = new Map(
    (remoteState?.data.gallery ?? []).filter((asset) => asset && asset.id).map((asset) => [asset.id, asset]),
  )
  const usedKeys = new Set<string>()
  const maxBytes = remoteSummary(remote.health).limits?.assetBytes ?? DEFAULT_ASSET_MAX_BYTES
  const gallery: SyncGalleryAsset[] = []

  for (const sourceAsset of localData.gallery) {
    const remoteAsset = remoteById.get(sourceAsset.id)
    if (assetReference(remoteAsset)) {
      gallery.push({
        ...sourceAsset,
        dataUrl: remoteAsset!.dataUrl,
        remoteKey: remoteAsset!.remoteKey,
      })
      summary.existing += 1
      continue
    }

    if (!includeAssets || !config.assets) {
      gallery.push({
        ...sourceAsset,
        dataUrl: absoluteUrl(sourceAsset.dataUrl, options.localOrigin ?? ''),
      })
      continue
    }

    try {
      const local = await readLocalAssetBytes(config, sourceAsset, options)
      if (local.bytes.byteLength > maxBytes) {
        throw new SyncError(413, 'asset_too_large', '图片超过远端大小限制')
      }
      const key = pickAssetKey(sourceAsset, local.contentType, usedKeys)
      const uploaded = await uploadRemoteAsset(
        options,
        remote,
        key,
        local.bytes,
        local.contentType,
      )
      gallery.push({
        ...sourceAsset,
        dataUrl: uploaded.url,
        remoteKey: uploaded.key,
      })
      summary.transferred += 1
    } catch (error) {
      summary.failed += 1
      const reason = error instanceof Error ? error.message : '未知错误'
      addWarning(summary, `图片「${sourceAsset.name || sourceAsset.id}」上传失败：${reason}`)
      gallery.push({
        ...sourceAsset,
        dataUrl: absoluteUrl(sourceAsset.dataUrl, options.localOrigin ?? ''),
      })
    }
  }

  targetData.gallery = gallery
  return summary
}

async function syncAssetsForDownload(
  config: ApiConfig,
  localState: RemoteState | null,
  remoteData: SyncAppData,
  remote: RemoteConnection,
  options: SyncOptions,
  includeAssets: boolean,
  targetData: SyncAppData,
): Promise<AssetTransferSummary> {
  const summary: AssetTransferSummary = {
    enabled: includeAssets,
    total: remoteData.gallery.length,
    transferred: 0,
    existing: 0,
    failed: 0,
    warnings: [],
  }
  const localById = new Map(
    (localState?.data.gallery ?? []).filter((asset) => asset && asset.id).map((asset) => [asset.id, asset]),
  )
  const usedKeys = new Set<string>()
  const maxBytes = config.assetMaxBytes ?? DEFAULT_ASSET_MAX_BYTES
  const gallery: SyncGalleryAsset[] = []

  for (const sourceAsset of remoteData.gallery) {
    const localAsset = localById.get(sourceAsset.id)
    if (localAsset && (await localAssetExists(config, localAsset))) {
      gallery.push({
        ...sourceAsset,
        dataUrl: localAsset.dataUrl,
        remoteKey: localAsset.remoteKey,
      })
      summary.existing += 1
      continue
    }

    if (!includeAssets || !config.assets) {
      gallery.push({
        ...sourceAsset,
        dataUrl: absoluteUrl(sourceAsset.dataUrl, remote.origin),
      })
      continue
    }

    try {
      const original = await readRemoteAssetBytes(options, remote, sourceAsset, maxBytes)
      if (original.bytes.byteLength > maxBytes) {
        throw new SyncError(413, 'asset_too_large', '图片超过本机大小限制')
      }
      const key = pickAssetKey(sourceAsset, original.contentType, usedKeys)
      const stored = await config.assets.putAsset(key, original.bytes, original.contentType)
      gallery.push({
        ...sourceAsset,
        dataUrl: stored.url,
        remoteKey: stored.key,
      })
      summary.transferred += 1
    } catch (error) {
      summary.failed += 1
      const reason = error instanceof Error ? error.message : '未知错误'
      addWarning(summary, `图片「${sourceAsset.name || sourceAsset.id}」下载失败：${reason}`)
      gallery.push({
        ...sourceAsset,
        dataUrl: absoluteUrl(sourceAsset.dataUrl, remote.origin),
      })
    }
  }

  targetData.gallery = gallery
  return summary
}

async function pushRemoteState(
  options: SyncOptions,
  remote: RemoteConnection,
  data: SyncAppData,
): Promise<number> {
  const serialized = JSON.stringify({ data })
  const max = remoteSummary(remote.health).limits?.stateBytes ?? DEFAULT_STATE_MAX_BYTES
  if (serialized.length > max) {
    throw new SyncError(413, 'state_too_large', '导航数据超过远端大小限制')
  }
  const response = await remoteFetch(options, `${remote.base}/api/state`, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${remote.token}`,
      'content-type': 'application/json',
    },
    body: serialized,
  })
  if (!response.ok) {
    throw new SyncError(
      502,
      'remote_save_failed',
      `保存到远端失败：${await readRemoteError(response)}`,
    )
  }
  const payload = await readResponseJson<{ updatedAt?: unknown }>(response)
  return typeof payload.updatedAt === 'number' && Number.isFinite(payload.updatedAt)
    ? payload.updatedAt
    : Date.now()
}

function localStateLimit(config: ApiConfig): number {
  return config.stateMaxBytes ?? DEFAULT_STATE_MAX_BYTES
}

export async function performSync(
  config: ApiConfig,
  input: JsonRecord,
  options: SyncOptions = {},
): Promise<SyncResult> {
  const action: SyncAction = input.action === 'test' ? 'test' : 'sync'
  const mode = normalizeMode(input.mode)
  const includeAssets = input.includeAssets !== false
  const remoteUrl = readString(input.remoteUrl)
  const password = readString(input.password)

  if (!remoteUrl) throw new SyncError(400, 'remote_url_required', '请输入远端地址')
  if (!password) throw new SyncError(400, 'password_required', '请输入远端管理员密码')

  const remote = await connectRemote(options, remoteUrl, password)
  const remoteState = await readRemoteState(options, remote)
  let localState: RemoteState | null = null
  try {
    localState = await readLocalState(config)
  } catch (error) {
    if (action === 'test') {
      localState = null
    } else {
      throw error
    }
  }

  const remoteInfo = remoteSummary(remote.health)
  const localUpdatedAt = localState?.updatedAt ?? null
  const remoteUpdatedAt = remoteState?.updatedAt ?? null

  if (action === 'test') {
    return {
      ok: true,
      action,
      mode,
      direction: 'none',
      localUpdatedAt,
      remoteUpdatedAt,
      updatedAt: null,
      remote: remoteInfo,
      empty: remoteState === null,
    }
  }

  if (!localState && !remoteState) {
    throw new SyncError(400, 'both_empty', '本机和远端都还没有数据，请先在其中一端完成初始化')
  }

  let direction: SyncDirection
  if (mode === 'upload') {
    if (!localState) {
      throw new SyncError(400, 'local_empty', '本机还没有可上传的数据')
    }
    direction = 'upload'
  } else if (mode === 'download') {
    if (!remoteState) {
      throw new SyncError(400, 'remote_empty', '远端还没有可下载的数据')
    }
    direction = 'download'
  } else if (!localState) {
    direction = 'download'
  } else if (!remoteState) {
    direction = 'upload'
  } else if (comparableData(localState.data) === comparableData(remoteState.data)) {
    direction = 'none'
  } else {
    direction = remoteState.updatedAt > localState.updatedAt ? 'download' : 'upload'
  }

  if (direction === 'none') {
    return {
      ok: true,
      action,
      mode,
      direction,
      localUpdatedAt,
      remoteUpdatedAt,
      updatedAt: null,
      remote: remoteInfo,
      warnings: ['两端导航内容已经一致，没有传输数据。'],
    }
  }

  if (direction === 'upload') {
    const target = cloneData(localState!.data)
    const assets = await syncAssetsForUpload(
      config,
      localState!.data,
      remoteState,
      remote,
      options,
      includeAssets,
      target,
    )
    const updatedAt = await pushRemoteState(options, remote, target)
    return {
      ok: true,
      action,
      mode,
      direction,
      localUpdatedAt,
      remoteUpdatedAt,
      updatedAt,
      remote: remoteInfo,
      assets,
      warnings: assets.warnings,
    }
  }

  const target = cloneData(remoteState!.data)
  const assets = await syncAssetsForDownload(
    config,
    localState,
    remoteState!.data,
    remote,
    options,
    includeAssets,
    target,
  )
  const serialized = JSON.stringify(target)
  if (serialized.length > localStateLimit(config)) {
    throw new SyncError(413, 'state_too_large', '远端导航数据超过本机大小限制')
  }
  if (!config.state) {
    throw new SyncError(503, 'local_storage_unavailable', '本机服务端存储尚未配置')
  }
  let updatedAt: number
  try {
    updatedAt = await config.state.putState(target)
  } catch {
    throw new SyncError(503, 'local_save_failed', '保存到本机失败')
  }
  return {
    ok: true,
    action,
    mode,
    direction,
    localUpdatedAt: updatedAt,
    remoteUpdatedAt,
    updatedAt,
    remote: remoteInfo,
    assets,
    warnings: assets.warnings,
    data: target,
  }
}
