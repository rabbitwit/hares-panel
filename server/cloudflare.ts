import type { ApiConfig, AssetStore, StateStore, SyncMeta } from './core'

/** Minimal structural types so the Worker bundle stays free of runtime packages. */
export interface KVNamespaceLike {
  get(key: string): Promise<string | null>
  get(key: string, options: { type: 'arrayBuffer' }): Promise<ArrayBuffer | null>
  put(
    key: string,
    value: string | ArrayBuffer | ArrayBufferView,
    options?: { metadata?: Record<string, string> },
  ): Promise<void>
  delete(key: string): Promise<void>
  getWithMetadata(
    key: string,
    options: { type: 'arrayBuffer' },
  ): Promise<{
    value: ArrayBuffer | null
    metadata: { contentType?: string } | null
  }>
}

interface D1Result<T> {
  results?: T[]
  success?: boolean
}

export interface D1PreparedLike {
  bind(...values: unknown[]): D1PreparedLike
  first<T = unknown>(): Promise<T | null>
  run(): Promise<D1Result<unknown>>
}

export interface D1DatabaseLike {
  prepare(query: string): D1PreparedLike
}

export interface R2ObjectLike {
  arrayBuffer(): Promise<ArrayBuffer>
  httpMetadata?: { contentType?: string }
}

export interface R2BucketLike {
  put(
    key: string,
    value: Uint8Array,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>
  get(key: string): Promise<R2ObjectLike | null>
  delete(key: string): Promise<void>
}

export interface EnvLike {
  ASSETS?: { fetch(request: Request): Promise<Response> }
  hares_panel?: D1DatabaseLike
  hares_panel_kv?: KVNamespaceLike
  hares_panel_assets?: R2BucketLike
  /** Uppercase aliases accepted for compatibility with older deployments. */
  HARES_DB?: D1DatabaseLike
  HARES_KV?: KVNamespaceLike
  HARES_BUCKET?: R2BucketLike
  ADMIN_PASSWORD?: string
  SESSION_SECRET?: string
}

const STATE_KEY = 'hares-panel:state:default'
const STATE_META_KEY = 'hares-panel:sync-meta:default'

function kvStateStore(kv: KVNamespaceLike): StateStore {
  return {
    kind: 'kv',
    async getState() {
      const raw = await kv.get(STATE_KEY)
      if (!raw) return null
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
      await kv.put(STATE_KEY, JSON.stringify({ data, updatedAt }))
      return updatedAt
    },
    async getMeta() {
      const raw = await kv.get(STATE_META_KEY)
      if (!raw) return null
      try {
        const parsed = JSON.parse(raw)
        return parsed && typeof parsed === 'object' ? (parsed as SyncMeta) : null
      } catch {
        return null
      }
    },
    async putMeta(meta) {
      await kv.put(STATE_META_KEY, JSON.stringify(meta))
    },
  }
}

const D1_TABLE = 'hares_panel_state'

let d1Ready: Promise<unknown> | null = null

function ensureD1Table(db: D1DatabaseLike): Promise<unknown> {
  if (!d1Ready) {
    d1Ready = db
      .prepare(
        `CREATE TABLE IF NOT EXISTS ${D1_TABLE} (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL)`,
      )
      .run()
      .catch((error) => {
        d1Ready = null
        throw error
      })
  }
  return d1Ready
}

function parseD1Row(row: { data: string; updated_at: number }) {
  try {
    return { data: JSON.parse(row.data), updatedAt: row.updated_at }
  } catch {
    return null
  }
}

function writeD1State(
  db: D1DatabaseLike,
  data: unknown,
  updatedAt: number,
): Promise<unknown> {
  return db
    .prepare(
      `INSERT INTO ${D1_TABLE} (id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    )
    .bind('default', JSON.stringify(data), updatedAt)
    .run()
}

const D1_META_TABLE = 'hares_panel_sync_meta'

let d1MetaReady: Promise<unknown> | null = null

function ensureD1MetaTable(db: D1DatabaseLike): Promise<unknown> {
  if (!d1MetaReady) {
    d1MetaReady = db
      .prepare(
        `CREATE TABLE IF NOT EXISTS ${D1_META_TABLE} (id TEXT PRIMARY KEY, data TEXT NOT NULL)`,
      )
      .run()
      .catch((error) => {
        d1MetaReady = null
        throw error
      })
  }
  return d1MetaReady
}

function d1StateStore(db: D1DatabaseLike): StateStore {
  return {
    kind: 'd1',
    async getState() {
      await ensureD1Table(db)
      const row = await db
        .prepare(`SELECT data, updated_at FROM ${D1_TABLE} WHERE id = ?`)
        .bind('default')
        .first<{ data: string; updated_at: number }>()
      return row ? parseD1Row(row) : null
    },
    async putState(data) {
      await ensureD1Table(db)
      const updatedAt = Date.now()
      await writeD1State(db, data, updatedAt)
      return updatedAt
    },
    async getMeta() {
      await ensureD1MetaTable(db)
      const row = await db
        .prepare(`SELECT data FROM ${D1_META_TABLE} WHERE id = ?`)
        .bind('default')
        .first<{ data: string }>()
      if (!row) return null
      try {
        const parsed = JSON.parse(row.data)
        return parsed && typeof parsed === 'object' ? (parsed as SyncMeta) : null
      } catch {
        return null
      }
    },
    async putMeta(meta) {
      await ensureD1MetaTable(db)
      await db
        .prepare(
          `INSERT INTO ${D1_META_TABLE} (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
        )
        .bind('default', JSON.stringify(meta))
        .run()
    },
  }
}

function r2AssetStore(bucket: R2BucketLike): AssetStore {
  return {
    kind: 'r2',
    async putAsset(key, bytes, contentType) {
      await bucket.put(key, bytes, { httpMetadata: { contentType } })
      return { key, url: `/api/assets/${encodeURIComponent(key)}` }
    },
    async getAsset(key) {
      const object = await bucket.get(key)
      if (!object) return null
      return {
        bytes: new Uint8Array(await object.arrayBuffer()),
        contentType: object.httpMetadata?.contentType || 'application/octet-stream',
      }
    },
    async deleteAsset(key) {
      await bucket.delete(key)
    },
  }
}

const ASSET_KEY_PREFIX = 'hares-panel:asset:'

function kvAssetStore(kv: KVNamespaceLike): AssetStore {
  return {
    kind: 'kv',
    async putAsset(key, bytes, contentType) {
      await kv.put(`${ASSET_KEY_PREFIX}${key}`, bytes, { metadata: { contentType } })
      return { key, url: `/api/assets/${encodeURIComponent(key)}` }
    },
    async getAsset(key) {
      const stored = await kv.getWithMetadata(`${ASSET_KEY_PREFIX}${key}`, { type: 'arrayBuffer' })
      if (!stored.value) return null
      return {
        bytes: new Uint8Array(stored.value),
        contentType: stored.metadata?.contentType || 'application/octet-stream',
      }
    },
    async deleteAsset(key) {
      await kv.delete(`${ASSET_KEY_PREFIX}${key}`)
    },
  }
}

export function createApiConfig(env: EnvLike): ApiConfig {
  const db = env.hares_panel ?? env.HARES_DB
  const kv = env.hares_panel_kv ?? env.HARES_KV
  const bucket = env.hares_panel_assets ?? env.HARES_BUCKET
  const state = db ? d1StateStore(db) : kv ? kvStateStore(kv) : null
  const assets = bucket ? r2AssetStore(bucket) : kv ? kvAssetStore(kv) : null
  return {
    adminPassword: env.ADMIN_PASSWORD?.trim() ?? '',
    sessionSecret: env.SESSION_SECRET?.trim() || undefined,
    state,
    assets,
    runtime: 'cloudflare-workers',
    // Workers exposes `navigator.userAgent === 'Cloudflare-Workers'`.
    platform: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  }
}
