/**
 * Local mock of the cloud backend used by the Playwright cloud tests.
 * It serves `dist/` and implements the same API as the Worker / Vercel
 * functions by bundling `server/core.ts` and using in-memory stores.
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const outfile = path.join(root, '.tmp', 'api-core.mjs')
const apiOnly = process.argv.includes('--api-only')
const port = Number(process.env.MOCK_API_PORT || (apiOnly ? 8787 : 4180))
const adminPassword = process.env.MOCK_ADMIN_PASSWORD || 'cloud-pass-123'

fs.mkdirSync(path.dirname(outfile), { recursive: true })

await build({
  entryPoints: [path.join(root, 'server/core.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile,
  logLevel: 'silent',
})

const { handleApi } = await import(pathToFileURL(outfile).href)

let state = null
let syncMeta = null
const assets = new Map()

const config = {
  adminPassword,
  sessionSecret: 'mock-session-secret',
  state: {
    kind: 'kv',
    async getState() {
      return state
    },
    async putState(data) {
      state = { data, updatedAt: Date.now() }
      return state.updatedAt
    },
    async getMeta() {
      return syncMeta
    },
    async putMeta(value) {
      syncMeta = value
    },
  },
  assets: {
    kind: 'r2',
    async putAsset(key, bytes, contentType) {
      assets.set(key, { bytes, contentType })
      return { key, url: `/api/assets/${key}` }
    },
    async getAsset(key) {
      return assets.get(key) ?? null
    },
    async deleteAsset(key) {
      assets.delete(key)
    },
  },
}

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

async function readBody(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 12 * 1024 * 1024) throw new Error('payload too large')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

function send(res, status, headers, body) {
  res.writeHead(status, headers)
  res.end(body)
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host}`)

  if (url.pathname === '/__reset' && request.method === 'POST') {
    state = null
    assets.clear()
    send(response, 200, { 'content-type': 'application/json' }, '{"ok":true}')
    return
  }
  if (url.pathname === '/__raw' && request.method === 'GET') {
    const payload = JSON.stringify({
      state,
      assets: [...assets.keys()],
    })
    send(response, 200, { 'content-type': 'application/json' }, payload)
    return
  }

  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
    try {
      const method = (request.method || 'GET').toUpperCase()
      const body = method === 'GET' || method === 'HEAD' ? undefined : await readBody(request)
      const headers = new Headers()
      for (const [key, value] of Object.entries(request.headers)) {
        if (typeof value === 'string') headers.set(key, value)
        else if (Array.isArray(value)) headers.set(key, value.join(', '))
      }
      const webRequest = new Request(url, { method, headers, body })
      const webResponse = await handleApi(webRequest, config)
      const buffer = Buffer.from(await webResponse.arrayBuffer())
      const responseHeaders = {}
      webResponse.headers.forEach((value, key) => {
        responseHeaders[key] = value
      })
      send(response, webResponse.status, responseHeaders, buffer)
    } catch (error) {
      console.error('[mock] api error', error)
      send(response, 500, { 'content-type': 'application/json' }, '{"error":"internal"}')
    }
    return
  }

  if (apiOnly) {
    send(response, 404, { 'content-type': 'application/json' }, '{"error":"not_found"}')
    return
  }

  const requested = path.join(dist, decodeURIComponent(url.pathname))
  const safePath = requested.startsWith(dist) ? requested : path.join(dist, 'index.html')
  let filePath = safePath
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(dist, 'index.html')
  }
  try {
    const content = fs.readFileSync(filePath)
    send(
      response,
      200,
      {
        'content-type': mime[path.extname(filePath)] || 'application/octet-stream',
        'cache-control': 'no-store',
      },
      content,
    )
  } catch {
    send(response, 404, { 'content-type': 'text/plain' }, 'not found')
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(
    `[mock] Hares-Panel ${apiOnly ? 'API' : 'cloud mock'} listening on http://127.0.0.1:${port}`,
  )
})
