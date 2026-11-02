/**
 * File-backed storage for the self-hosted Node / Docker runtime.
 *
 * The Docker image keeps everything under a single mounted directory:
 *
 *   /data/state.json      navigation data written by the admin
 *   /data/assets/*        uploaded images
 *   /data/session-secret  generated once, used to sign login tokens
 *
 * Writes are serialized and committed with a temporary file + rename so a
 * crash during a save never leaves a half-written JSON file behind.
 */
import { randomBytes } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { ApiConfig, AssetStore, StateStore, StoredAsset } from './core'

export interface FileRuntimeEnv {
  HARES_DATA_DIR?: string
  HARES_STATE_FILE?: string
  HARES_ASSETS_DIR?: string
  HARES_RUNTIME?: string
  ADMIN_PASSWORD?: string
  SESSION_SECRET?: string
  HARES_STATE_MAX_MB?: string
  HARES_ASSET_MAX_MB?: string
}

export interface FileRuntime {
  config: ApiConfig
  dataDir: string
  stateFile: string
  assetsDir: string
}

const STATE_FILE = 'state.json'
const ASSETS_DIR = 'assets'
const SECRET_FILE = 'session-secret'
const DEFAULT_STATE_MAX_BYTES = 16 * 1024 * 1024
const DEFAULT_ASSET_MAX_BYTES = 16 * 1024 * 1024

const CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  ico: 'image/x-icon',
}

function byteLimit(value: string | undefined, fallback: number): number {
  const megabytes = Number(value)
  if (!Number.isFinite(megabytes) || megabytes <= 0) return fallback
  return Math.max(1, Math.floor(megabytes * 1024 * 1024))
}

function contentTypeFromKey(key: string): string {
  const extension = key.split('.').pop()?.toLowerCase() ?? ''
  return CONTENT_TYPES[extension] ?? 'application/octet-stream'
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  )
}

async function writeAtomic(file: string, content: string, mode = 0o600): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true })
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(temporary, content, { mode })
  try {
    await fs.rename(temporary, file)
  } catch (error) {
    // Windows occasionally refuses to replace an existing file with rename.
    // Fall back to a copy so local `npm run start` still works there.
    await fs.copyFile(temporary, file)
    await fs.unlink(temporary).catch(() => undefined)
    if (isMissing(error)) throw error
  }
}

function fileStateStore(file: string): StateStore {
  // Serialize writes inside this process. Reads are safe because the
  // replacement happens with an atomic rename.
  let queue: Promise<void> = Promise.resolve()

  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = queue.then(task, task)
    queue = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }

  return {
    kind: 'file',
    async getState() {
      let raw: string
      try {
        raw = await fs.readFile(file, 'utf8')
      } catch (error) {
        if (isMissing(error)) return null
        throw error
      }
      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        throw new Error(`导航数据文件不是有效的 JSON：${file}`)
      }
      if (!parsed || typeof parsed !== 'object' || !('data' in parsed)) {
        throw new Error(`导航数据文件格式不正确：${file}`)
      }
      const record = parsed as { data?: unknown; updatedAt?: unknown }
      return {
        data: record.data,
        updatedAt:
          typeof record.updatedAt === 'number' && Number.isFinite(record.updatedAt)
            ? record.updatedAt
            : Date.now(),
      }
    },
    async putState(data) {
      return enqueue(async () => {
        const updatedAt = Date.now()
        await writeAtomic(file, JSON.stringify({ data, updatedAt }))
        return updatedAt
      })
    },
  }
}

function safeAssetPath(root: string, key: string): string | null {
  if (!key || key.length > 200 || key.startsWith('/') || key.includes('\\') || key.includes('..')) {
    return null
  }
  const resolved = path.resolve(root, key)
  const relative = path.relative(root, resolved)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null
  return resolved
}

function fileAssetStore(root: string): AssetStore {
  return {
    kind: 'file',
    async putAsset(key, bytes, contentType) {
      const file = safeAssetPath(root, key)
      if (!file) throw new Error('invalid asset key')
      await fs.mkdir(path.dirname(file), { recursive: true })
      await fs.writeFile(file, bytes)
      return { key, url: `/api/assets/${encodeURIComponent(key)}` }
    },
    async getAsset(key) {
      const file = safeAssetPath(root, key)
      if (!file) return null
      let buffer: Buffer
      try {
        buffer = await fs.readFile(file)
      } catch (error) {
        if (isMissing(error)) return null
        throw error
      }
      const bytes = new Uint8Array(buffer.byteLength)
      bytes.set(buffer)
      return {
        bytes,
        contentType: contentTypeFromKey(key),
      } satisfies StoredAsset
    },
    async deleteAsset(key) {
      const file = safeAssetPath(root, key)
      if (!file) return
      try {
        await fs.unlink(file)
      } catch (error) {
        if (!isMissing(error)) throw error
      }
    },
  }
}

async function loadSessionSecret(dataDir: string, provided?: string): Promise<string> {
  const configured = provided?.trim()
  if (configured) return configured

  const file = path.join(dataDir, SECRET_FILE)
  try {
    const existing = (await fs.readFile(file, 'utf8')).trim()
    if (existing) return existing
  } catch (error) {
    if (!isMissing(error)) {
      console.warn('[hares-panel] 无法读取会话密钥，将在本次启动中使用临时密钥', error)
      return randomBytes(48).toString('base64url')
    }
  }

  const secret = randomBytes(48).toString('base64url')
  try {
    await fs.mkdir(dataDir, { recursive: true })
    await fs.writeFile(file, `${secret}\n`, { mode: 0o600 })
  } catch (error) {
    console.warn('[hares-panel] 无法保存会话密钥，将在本次启动中使用临时密钥', error)
  }
  return secret
}

export async function createFileRuntime(env: FileRuntimeEnv = process.env): Promise<FileRuntime> {
  const dataDir = path.resolve(env.HARES_DATA_DIR?.trim() || path.join(process.cwd(), 'data'))
  const stateFile = env.HARES_STATE_FILE?.trim()
    ? path.resolve(env.HARES_STATE_FILE.trim())
    : path.join(dataDir, STATE_FILE)
  const assetsDir = env.HARES_ASSETS_DIR?.trim()
    ? path.resolve(env.HARES_ASSETS_DIR.trim())
    : path.join(dataDir, ASSETS_DIR)
  const secret = await loadSessionSecret(dataDir, env.SESSION_SECRET)

  return {
    dataDir,
    stateFile,
    assetsDir,
    config: {
      adminPassword: env.ADMIN_PASSWORD?.trim() ?? '',
      sessionSecret: secret,
      state: fileStateStore(stateFile),
      assets: fileAssetStore(assetsDir),
      stateMaxBytes: byteLimit(env.HARES_STATE_MAX_MB, DEFAULT_STATE_MAX_BYTES),
      assetMaxBytes: byteLimit(env.HARES_ASSET_MAX_MB, DEFAULT_ASSET_MAX_BYTES),
      runtime: env.HARES_RUNTIME?.trim() || 'docker',
      platform: `${process.version} · ${process.platform}`,
    },
  }
}
