import type { AppData } from '@/types'

export const CLOUD_API_BASE = '/api'

export type CloudStorageKind = 'kv' | 'd1' | 'redis' | 'edgeone-blob' | 'file'
export type CloudAssetKind = 'r2' | 'blob' | 'edgeone-blob' | 'file'

export interface CloudHealth {
  app?: string
  version?: number
  ok: boolean
  /** Runtime reported by the API itself, e.g. `cloudflare-workers` / `vercel`. */
  runtime?: string | null
  /** Extra platform detail, e.g. `Cloudflare-Workers` or `v22.14.0`. */
  platform?: string | null
  storage: CloudStorageKind | null
  assets: CloudAssetKind | null
  auth: boolean
  limits?: { stateBytes: number; assetBytes: number }
}

export interface CloudSession {
  token: string
  expiresAt: number
}

export interface CloudState {
  data: AppData
  updatedAt: number
}

export type CloudUpdateSource = 'docker-hub' | 'github' | 'docker-hub+github'

export interface CloudUpdateInfo {
  currentVersion: string | null
  latestVersion: string
  latestTag: string | null
  image: string
  source: CloudUpdateSource
  publishedAt: number | null
  checkedAt: number
  updateAvailable: boolean | null
}

export interface CloudUploadResult {
  key: string
  url: string
  size: number
  contentType: string
}

export type CloudSyncMode = 'auto' | 'upload' | 'download'
export type CloudSyncDirection = 'upload' | 'download' | 'none'
export type CloudSyncAction = 'sync' | 'test'

/** Last cross-instance sync outcome, shown read-only on the target instance. */
export interface CloudSyncMeta {
  lastSyncAt: number
  success: boolean
  direction: CloudSyncDirection
  error?: string
}

export interface CloudSyncRemoteSummary {
  app: string
  version: number | null
  ok: boolean
  runtime: string | null
  storage: string | null
  assets: string | null
  limits: { stateBytes: number; assetBytes: number } | null
}

export interface CloudSyncAssetSummary {
  enabled: boolean
  total: number
  transferred: number
  existing: number
  failed: number
  warnings: string[]
}

export interface CloudSyncResult {
  ok: boolean
  action: CloudSyncAction
  mode: CloudSyncMode
  direction: CloudSyncDirection
  localUpdatedAt: number | null
  remoteUpdatedAt: number | null
  updatedAt: number | null
  remote: CloudSyncRemoteSummary
  empty?: boolean
  assets?: CloudSyncAssetSummary
  warnings?: string[]
  data?: AppData
}

export interface CloudSyncOptions {
  remoteUrl: string
  password: string
  mode?: CloudSyncMode
  includeAssets?: boolean
  action?: CloudSyncAction
}

export class CloudApiError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'CloudApiError'
    this.status = status
    this.code = code
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: RequestInit['body']
  timeoutMs?: number
}

async function requestOnce<T>(path: string, options: RequestOptions): Promise<T> {
  const { timeoutMs = 12_000, headers, ...init } = options
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${CLOUD_API_BASE}${path}`, {
      ...init,
      headers: { accept: 'application/json', ...(headers as Record<string, string> | undefined) },
      signal: controller.signal,
    })
    const text = await response.text()
    let payload: Record<string, unknown> | null = null
    try {
      payload = text ? (JSON.parse(text) as Record<string, unknown>) : null
    } catch {
      payload = null
    }
    if (!response.ok) {
      const code = typeof payload?.error === 'string' ? payload.error : 'http_error'
      const message =
        typeof payload?.message === 'string'
          ? payload.message
          : `服务端请求失败（${response.status}）`
      throw new CloudApiError(response.status, code, message)
    }
    if (!payload) {
      throw new CloudApiError(response.status, 'bad_response', '服务端返回了无法识别的数据')
    }
    return payload as T
  } catch (error) {
    if (error instanceof CloudApiError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new CloudApiError(0, 'timeout', '请求超时，请稍后重试')
    }
    throw new CloudApiError(0, 'network', '无法连接服务端，请检查网络后重试')
  } finally {
    window.clearTimeout(timer)
  }
}

async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase()
  // GET/PUT are safe to repeat: the full state write is idempotent. A single
  // retry also covers short workers.dev/TLS connection resets.
  const retries = method === 'GET' || method === 'PUT' ? 1 : 0

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await requestOnce<T>(path, options)
    } catch (error) {
      const retryable =
        error instanceof CloudApiError &&
        (error.code === 'network' ||
          error.code === 'timeout' ||
          error.status === 429 ||
          error.status >= 500)
      if (!retryable || attempt >= retries) throw error
      await new Promise((resolve) => window.setTimeout(resolve, 500 + attempt * 500))
    }
  }
}

function isHealth(value: unknown): value is CloudHealth {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.ok === 'boolean'
}

export async function getCloudHealth(): Promise<CloudHealth | null> {
  const probed = await probeCloudHealth()
  return probed.info
}

export async function probeCloudHealth(): Promise<{ info: CloudHealth | null; error: string | null }> {
  try {
    // Vercel Hobby cold start + Upstash ping can exceed 3s; 3.5s made a working
    // function look like "API unreachable".
    const payload = await api<CloudHealth>('/health', { timeoutMs: 15_000 })
    if (!isHealth(payload)) {
      return {
        info: null,
        error: '服务端 /api/health 返回了无法识别的数据（多半是网页而不是 JSON，说明 API 函数没有挂上）。',
      }
    }
    return { info: payload, error: null }
  } catch (error) {
    if (error instanceof CloudApiError) {
      if (error.code === 'timeout') {
        return { info: null, error: '连接 /api/health 超时。请到 Vercel → Deployments → Functions 查看函数是否存在、是否冷启动过久。' }
      }
      if (error.code === 'bad_response') {
        return { info: null, error: '访问 /api/health 没有返回 JSON。API 函数可能没部署，或被重写成了前端页面。' }
      }
      if (error.status === 404) {
        return { info: null, error: '/api/health 返回 404，Vercel 没有挂上 API 函数。请拉取最新代码后 Redeploy。' }
      }
      if (error.status === 0 || error.code === 'network') {
        return { info: null, error: '无法连接服务端 API（/api/health）。请直接在浏览器打开该地址，确认返回的是 JSON。' }
      }
      return { info: null, error: error.message }
    }
    return { info: null, error: '无法连接服务端 API（/api/health）。' }
  }
}

export async function getCloudUpdate(
  currentVersion: string,
  options: { force?: boolean } = {},
): Promise<CloudUpdateInfo> {
  const query = new URLSearchParams({ current: currentVersion })
  if (options.force) query.set('force', '1')
  return api<CloudUpdateInfo>(`/update?${query.toString()}`, { timeoutMs: 15_000 })
}

export async function cloudLogin(password: string): Promise<CloudSession> {
  return api<CloudSession>('/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
    timeoutMs: 12_000,
  })
}

export async function refreshCloudSession(token: string): Promise<CloudSession> {
  return api<CloudSession>('/session/refresh', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    timeoutMs: 12_000,
  })
}

export async function fetchCloudState(token?: string): Promise<CloudState | null> {
  try {
    const result = await api<CloudState>(token ? '/state?full=1' : '/state', {
      headers: token ? { authorization: `Bearer ${token}` } : undefined,
      timeoutMs: 12_000,
    })
    if (!result || typeof result.data !== 'object' || result.data === null) {
      throw new CloudApiError(0, 'bad_state', '服务端数据格式不正确')
    }
    return {
      data: result.data,
      updatedAt: typeof result.updatedAt === 'number' ? result.updatedAt : Date.now(),
    }
  } catch (error) {
    if (error instanceof CloudApiError && error.status === 404) return null
    throw error
  }
}

export async function pushCloudState(
  token: string,
  data: AppData,
): Promise<{ updatedAt: number }> {
  return api<{ updatedAt: number }>('/state', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ data }),
    timeoutMs: 30_000,
  })
}

export async function uploadCloudAsset(
  token: string,
  blob: Blob,
  filename: string,
): Promise<CloudUploadResult> {
  const form = new FormData()
  form.append('file', blob, filename)
  return api<CloudUploadResult>('/assets', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: form,
    timeoutMs: 45_000,
  })
}

export async function deleteCloudAsset(
  token: string,
  key: string,
  url?: string,
): Promise<void> {
  await api<{ ok: boolean }>(`/assets/${encodeURIComponent(key)}`, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ url }),
    timeoutMs: 15_000,
  })
}

export async function syncCloudState(
  token: string,
  options: {
    remoteUrl: string
    password: string
    mode?: CloudSyncMode
    includeAssets?: boolean
    action?: CloudSyncAction
  },
): Promise<CloudSyncResult> {
  return api<CloudSyncResult>('/sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({
      remoteUrl: options.remoteUrl,
      password: options.password,
      mode: options.mode ?? 'auto',
      includeAssets: options.includeAssets !== false,
      action: options.action ?? 'sync',
    }),
    timeoutMs: 90_000,
  })
}

/** Read this instance's last sync status (read-only on the target/public side). */
export async function fetchSyncMeta(token: string): Promise<CloudSyncMeta | null> {
  const payload = await api<{ meta?: unknown }>('/sync/status', {
    headers: { authorization: `Bearer ${token}` },
    timeoutMs: 12_000,
  })
  const meta = payload?.meta
  if (!meta || typeof meta !== 'object') return null
  const record = meta as Record<string, unknown>
  return {
    lastSyncAt: typeof record.lastSyncAt === 'number' ? record.lastSyncAt : Date.now(),
    success: record.success !== false,
    direction:
      record.direction === 'upload' || record.direction === 'download' ? record.direction : 'none',
    ...(typeof record.error === 'string' && record.error ? { error: record.error } : {}),
  }
}

export function dataUrlToBlob(dataUrl: string): Blob {
  if (!dataUrl.startsWith('data:')) {
    throw new Error('不是有效的 Data URL')
  }
  const comma = dataUrl.indexOf(',')
  if (comma < 0) throw new Error('Data URL 格式不正确')
  const meta = dataUrl.slice(0, comma)
  const payload = dataUrl.slice(comma + 1)
  const mime = meta.match(/^data:([^;]+)/)?.[1] || 'application/octet-stream'
  if (/;base64/i.test(meta)) {
    const binary = atob(payload)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
    return new Blob([bytes], { type: mime })
  }
  return new Blob([decodeURIComponent(payload)], { type: mime })
}

export function cloudStorageLabel(kind: CloudStorageKind | null | undefined): string {
  switch (kind) {
    case 'kv':
      return 'Cloudflare KV'
    case 'd1':
      return 'Cloudflare D1'
    case 'redis':
      return 'Upstash Redis'
    case 'edgeone-blob':
      return 'EdgeOne Blob'
    case 'file':
      return 'Docker 本地文件'
    default:
      return '未配置'
  }
}

export function cloudAssetLabel(kind: CloudAssetKind | null | undefined): string {
  switch (kind) {
    case 'r2':
      return 'Cloudflare R2'
    case 'blob':
      return 'Vercel Blob'
    case 'edgeone-blob':
      return 'EdgeOne Blob'
    case 'file':
      return 'Docker 本地文件'
    default:
      return '未配置'
  }
}
