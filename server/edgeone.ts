import type { ApiConfig, AssetStore, StateStore, StoredAsset } from './core'

/**
 * Minimal structural interface for `@edgeone/pages-blob`'s `Store`.
 *
 * The SDK is only available inside EdgeOne Makers Node Functions. Keeping the
 * adapter free of a runtime import lets the same code be tested with a small
 * in-memory store.
 */
export interface EdgeOneBlobStore {
  get(
    key: string,
    options: { type: 'json' | 'arrayBuffer'; consistency?: 'eventual' | 'strong' },
  ): Promise<unknown>
  set(key: string, value: Blob, options?: { cacheControl?: string | null }): Promise<unknown>
  setJSON(key: string, value: unknown): Promise<unknown>
  delete(key: string): Promise<unknown>
}

export interface EdgeOneEnv {
  ADMIN_PASSWORD?: string
  SESSION_SECRET?: string
  /** Optional Blob namespace; defaults to `hares-panel`. */
  HARES_BLOB_STORE?: string
}

const STATE_KEY = 'state/default.json'
const ASSET_PREFIX = 'assets/'

/** EdgeOne's Node Functions accept requests up to 6 MB. */
const EDGEONE_MAX_BODY_BYTES = 5 * 1024 * 1024

function edgeOneStateStore(store: EdgeOneBlobStore): StateStore {
  return {
    kind: 'edgeone-blob',
    async getState() {
      const value = await store.get(STATE_KEY, { type: 'json', consistency: 'strong' })
      if (!value || typeof value !== 'object') return null
      const record = value as { data?: unknown; updatedAt?: unknown }
      if (!('data' in record)) return null
      return {
        data: record.data,
        updatedAt:
          typeof record.updatedAt === 'number' && Number.isFinite(record.updatedAt)
            ? record.updatedAt
            : Date.now(),
      }
    },
    async putState(data) {
      const updatedAt = Date.now()
      await store.setJSON(STATE_KEY, { data, updatedAt })
      return updatedAt
    },
  }
}

function edgeOneAssetStore(store: EdgeOneBlobStore): AssetStore {
  return {
    kind: 'edgeone-blob',
    async putAsset(key, bytes, contentType) {
      // The key always carries the image extension, so the shared handler can
      // infer the response Content-Type without a second metadata object.
      await store.set(`${ASSET_PREFIX}${key}`, new Blob([bytes], { type: contentType }), {
        cacheControl: 'public, max-age=31536000, immutable',
      })
      return { key, url: `/api/assets/${encodeURIComponent(key)}` }
    },
    async getAsset(key) {
      const value = await store.get(`${ASSET_PREFIX}${key}`, {
        type: 'arrayBuffer',
        consistency: 'strong',
      })
      if (value instanceof Uint8Array) {
        return { bytes: new Uint8Array(value), contentType: '' } satisfies StoredAsset
      }
      if (value instanceof ArrayBuffer) {
        return { bytes: new Uint8Array(value), contentType: '' } satisfies StoredAsset
      }
      return null
    },
    async deleteAsset(key) {
      await store.delete(`${ASSET_PREFIX}${key}`)
    },
  }
}

export function createEdgeOneConfig(
  store: EdgeOneBlobStore | null,
  env: EdgeOneEnv,
): ApiConfig {
  return {
    adminPassword: env.ADMIN_PASSWORD?.trim() ?? '',
    sessionSecret: env.SESSION_SECRET?.trim() || undefined,
    state: store ? edgeOneStateStore(store) : null,
    assets: store ? edgeOneAssetStore(store) : null,
    stateMaxBytes: EDGEONE_MAX_BODY_BYTES,
    assetMaxBytes: EDGEONE_MAX_BODY_BYTES,
    runtime: 'edgeone',
    platform:
      typeof process !== 'undefined' && process.version
        ? `${process.version} · EdgeOne Makers`
        : 'EdgeOne Makers',
  }
}
