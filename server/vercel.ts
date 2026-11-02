import type { IncomingMessage, ServerResponse } from 'node:http'
import { del, put } from '@vercel/blob'
import type { ApiConfig, AssetStore, StateStore } from './core'

export interface VercelEnv {
  ADMIN_PASSWORD?: string
  SESSION_SECRET?: string
  KV_REST_API_URL?: string
  KV_REST_API_TOKEN?: string
  UPSTASH_REDIS_REST_URL?: string
  UPSTASH_REDIS_REST_TOKEN?: string
  BLOB_READ_WRITE_TOKEN?: string
}

const STATE_KEY = 'hares-panel:state:default'
const ASSET_PREFIX = 'hares-panel'
const MAX_REQUEST_BYTES = 12 * 1024 * 1024

function redisCredentials(env: VercelEnv) {
  const url = (env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL || '').replace(/\/+$/, '')
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN || ''
  return url && token ? { url, token } : null
}

async function redisRequest(
  credentials: { url: string; token: string },
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  const response = await fetch(`${credentials.url}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${credentials.token}`,
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) throw new Error(`Redis request failed: ${response.status}`)
  const data = (await response.json()) as { result?: unknown; error?: string }
  if (data.error) throw new Error(data.error)
  return data.result
}

function redisStateStore(credentials: { url: string; token: string }): StateStore {
  return {
    kind: 'redis',
    async getState() {
      const raw = await redisRequest(credentials, `/get/${encodeURIComponent(STATE_KEY)}`)
      if (typeof raw !== 'string' || !raw) return null
      try {
        const parsed = JSON.parse(raw) as { data?: unknown; updatedAt?: number }
        if (!parsed || typeof parsed !== 'object' || !('data' in parsed)) return null
        return {
          data: parsed.data,
          updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
        }
      } catch {
        return null
      }
    },
    async putState(data) {
      const updatedAt = Date.now()
      await redisRequest(credentials, `/set/${encodeURIComponent(STATE_KEY)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ data, updatedAt }),
      })
      return updatedAt
    },
  }
}

function blobAssetStore(token: string): AssetStore {
  return {
    kind: 'blob',
    async putAsset(key, bytes, contentType) {
      const blob = await put(`${ASSET_PREFIX}/${key}`, new Blob([bytes], { type: contentType }), {
        access: 'public',
        token,
        contentType,
        addRandomSuffix: false,
        cacheControlMaxAge: 365 * 24 * 60 * 60,
      })
      return { key: blob.pathname, url: blob.url }
    },
    async getAsset() {
      // Vercel Blob files are served by the Blob CDN, not through this function.
      return null
    },
    async deleteAsset(key, url) {
      await del(url || key, { token })
    },
  }
}

export function createVercelConfig(env: VercelEnv): ApiConfig {
  const credentials = redisCredentials(env)
  const state = credentials ? redisStateStore(credentials) : null
  const assets = env.BLOB_READ_WRITE_TOKEN ? blobAssetStore(env.BLOB_READ_WRITE_TOKEN) : null
  const region = process.env.VERCEL_REGION?.trim()
  return {
    adminPassword: env.ADMIN_PASSWORD?.trim() ?? '',
    sessionSecret: env.SESSION_SECRET?.trim() || undefined,
    state,
    assets,
    runtime: 'vercel',
    // Node version plus the region Vercel actually routed this function to.
    platform: region ? `${process.version} · ${region}` : process.version,
  }
}

async function readRequestBody(request: IncomingMessage): Promise<Uint8Array<ArrayBuffer>> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string)
    total += buffer.length
    if (total > MAX_REQUEST_BYTES) throw new Error('PAYLOAD_TOO_LARGE')
    chunks.push(buffer)
  }
  const merged = Buffer.concat(chunks)
  const bytes = new Uint8Array(merged.byteLength)
  bytes.set(merged)
  return bytes
}

export async function toWebRequest(request: IncomingMessage): Promise<Request> {
  const host = request.headers['x-forwarded-host'] || request.headers.host || 'localhost'
  const url = new URL(request.url || '/', `https://${host}`)
  const headers = new Headers()
  for (const [key, value] of Object.entries(request.headers)) {
    if (typeof value === 'string') headers.set(key, value)
    else if (Array.isArray(value)) headers.set(key, value.join(', '))
  }
  const method = (request.method || 'GET').toUpperCase()
  const body = method === 'GET' || method === 'HEAD' ? undefined : await readRequestBody(request)
  return new Request(url, { method, headers, body })
}

export async function sendWebResponse(
  response: ServerResponse,
  webResponse: Response,
): Promise<void> {
  response.statusCode = webResponse.status
  webResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') return
    response.setHeader(key, value)
  })
  const body = Buffer.from(await webResponse.arrayBuffer())
  response.end(body)
}

export { MAX_REQUEST_BYTES }
