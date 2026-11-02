/**
 * Self-hosted Node HTTP server used by the Docker image and `npm start`.
 *
 * It serves the built SPA from `dist/` and forwards `/api/*` to the shared
 * runtime-agnostic API core. The container exposes this HTTP server directly;
 * put an existing Nginx / Caddy / router in front if you need TLS.
 */
import { promises as fs } from 'node:fs'
import http, { type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { handleApi } from './core'
import { createFileRuntime, type FileRuntime } from './file'

const DEFAULT_PORT = 18000
const MAX_REQUEST_BYTES = 32 * 1024 * 1024

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
}

interface ServerOptions {
  runtime: FileRuntime
  staticDir?: string
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  )
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.setHeader('cache-control', 'no-store')
  response.end(JSON.stringify(body))
}

async function readRequestBody(request: IncomingMessage): Promise<Uint8Array<ArrayBuffer>> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string)
    total += buffer.byteLength
    if (total > MAX_REQUEST_BYTES) {
      const error = new Error('PAYLOAD_TOO_LARGE')
      error.name = 'PayloadTooLargeError'
      throw error
    }
    chunks.push(buffer)
  }
  const merged = Buffer.concat(chunks)
  const bytes = new Uint8Array(merged.byteLength)
  bytes.set(merged)
  return bytes
}

async function toWebRequest(request: IncomingMessage, port: number): Promise<Request> {
  const forwardedProto = request.headers['x-forwarded-proto']
  const protocol =
    (typeof forwardedProto === 'string' ? forwardedProto.split(',')[0]?.trim() : '') || 'http'
  const forwardedHost = request.headers['x-forwarded-host']
  const host =
    (typeof forwardedHost === 'string' ? forwardedHost.split(',')[0]?.trim() : '') ||
    request.headers.host ||
    `127.0.0.1:${port}`
  const url = new URL(request.url || '/', `${protocol}://${host}`)
  const headers = new Headers()
  for (const [key, value] of Object.entries(request.headers)) {
    if (typeof value === 'string') headers.set(key, value)
    else if (Array.isArray(value)) headers.set(key, value.join(', '))
  }
  const method = (request.method || 'GET').toUpperCase()
  const body = method === 'GET' || method === 'HEAD' ? undefined : await readRequestBody(request)
  return new Request(url, { method, headers, body })
}

async function sendWebResponse(
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

function securityHeaders(response: ServerResponse): void {
  response.setHeader('x-content-type-options', 'nosniff')
  response.setHeader('referrer-policy', 'strict-origin-when-cross-origin')
}

async function readStaticFile(
  staticDir: string,
  pathname: string,
  acceptsHtml: boolean,
): Promise<{ file: string; bytes: Buffer; cacheControl: string } | null> {
  let decoded: string
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return null
  }
  if (decoded.includes('\0')) return null

  const relative = decoded.replace(/^\/+/, '')
  const candidate = path.resolve(staticDir, relative)
  const check = path.relative(staticDir, candidate)
  if (check.startsWith('..') || path.isAbsolute(check)) return null

  const indexPath = path.join(staticDir, 'index.html')
  let target = candidate
  try {
    const stat = await fs.stat(target)
    if (stat.isDirectory()) target = path.join(target, 'index.html')
  } catch (error) {
    if (!isMissing(error)) throw error
  }

  let bytes: Buffer
  try {
    bytes = await fs.readFile(target)
  } catch (error) {
    if (!isMissing(error)) throw error

    // Unknown routes fall back to the SPA shell; missing asset files do not.
    const extension = path.extname(relative)
    if (!acceptsHtml && extension && extension !== '.html') return null
    bytes = await fs.readFile(indexPath)
    target = indexPath
  }

  const normalized = path.relative(staticDir, target).replaceAll('\\', '/')
  const cacheControl =
    normalized.startsWith('assets/') || normalized.startsWith('_assets/')
      ? 'public, max-age=31536000, immutable'
      : normalized.endsWith('.html')
        ? 'no-cache'
        : 'public, max-age=86400'
  return { file: target, bytes, cacheControl }
}

function createHandler(options: ServerOptions) {
  const staticDir = path.resolve(options.staticDir || process.env.HARES_STATIC_DIR || 'dist')

  return async function handler(request: IncomingMessage, response: ServerResponse) {
    securityHeaders(response)
    const port = Number(process.env.PORT || process.env.APP_PORT || DEFAULT_PORT)
    let pathname = '/'
    try {
      pathname = new URL(request.url || '/', `http://127.0.0.1:${port}`).pathname
    } catch {
      sendJson(response, 400, { error: 'bad_request' })
      return
    }

    if (pathname === '/api' || pathname.startsWith('/api/')) {
      const declared = Number(request.headers['content-length'] || '0')
      if (Number.isFinite(declared) && declared > MAX_REQUEST_BYTES) {
        request.resume()
        sendJson(response, 413, {
          error: 'too_large',
          message: `请求体不能超过 ${Math.round(MAX_REQUEST_BYTES / 1024 / 1024)} MB`,
        })
        return
      }
      try {
        const webRequest = await toWebRequest(request, port)
        const webResponse = await handleApi(webRequest, options.runtime.config)
        await sendWebResponse(response, webResponse)
      } catch (error) {
        if (error instanceof Error && error.message === 'PAYLOAD_TOO_LARGE') {
          request.resume()
          sendJson(response, 413, {
            error: 'too_large',
            message: `请求体不能超过 ${Math.round(MAX_REQUEST_BYTES / 1024 / 1024)} MB`,
          })
          return
        }
        console.error('[hares-panel] API error', error)
        sendJson(response, 500, { error: 'internal_error', message: '服务器处理请求时出错' })
      }
      return
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      sendJson(response, 405, { error: 'method_not_allowed' })
      return
    }

    try {
      const acceptsHtml = (request.headers.accept || '').includes('text/html')
      const result = await readStaticFile(staticDir, pathname, acceptsHtml)
      if (!result) {
        response.statusCode = 404
        response.setHeader('content-type', 'text/plain; charset=utf-8')
        response.end('Not Found')
        return
      }
      response.statusCode = 200
      response.setHeader(
        'content-type',
        MIME_TYPES[path.extname(result.file).toLowerCase()] || 'application/octet-stream',
      )
      response.setHeader('content-length', String(result.bytes.byteLength))
      response.setHeader('cache-control', result.cacheControl)
      response.end(request.method === 'HEAD' ? undefined : result.bytes)
    } catch (error) {
      console.error('[hares-panel] static file error', error)
      if (!response.headersSent) {
        response.statusCode = 500
        response.setHeader('content-type', 'text/plain; charset=utf-8')
        response.end('Internal Server Error')
      } else {
        response.end()
      }
    }
  }
}

export function createHaresServer(options: ServerOptions): Server {
  return http.createServer(createHandler(options))
}

export async function startServer(env: NodeJS.ProcessEnv = process.env): Promise<Server> {
  const runtime = await createFileRuntime(env)
  const portValue = Number(env.PORT || env.APP_PORT || DEFAULT_PORT)
  const port = Number.isFinite(portValue) && portValue > 0 ? portValue : DEFAULT_PORT
  const host = env.HOST?.trim() || '0.0.0.0'
  const staticDir = path.resolve(env.HARES_STATIC_DIR?.trim() || 'dist')

  const server = createHaresServer({ runtime, staticDir })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, host, () => resolve())
  })

  console.log(`[hares-panel] listening on http://${host}:${port}`)
  console.log(`[hares-panel] static files: ${staticDir}`)
  console.log(`[hares-panel] data: ${runtime.dataDir} (${runtime.stateFile})`)
  if (!runtime.config.adminPassword) {
    console.warn(
      '[hares-panel] ADMIN_PASSWORD 未设置，登录接口会返回 503。Docker 入口脚本会自动生成密码。',
    )
  }

  let closing = false
  const shutdown = (signal: string) => {
    if (closing) return
    closing = true
    console.log(`[hares-panel] received ${signal}, shutting down`)
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(1), 10_000).unref()
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))

  return server
}

const isDirectRun = process.argv[1]
  ? import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
  : false

if (isDirectRun) {
  startServer().catch((error) => {
    console.error('[hares-panel] failed to start', error)
    process.exit(1)
  })
}
