/**
 * Tests the two production runtimes without deploying:
 * - Vercel Node function wrapper with a mock Upstash Redis REST server
 * - Cloudflare Worker entry with mock KV / D1 / R2 bindings
 */
import assert from 'node:assert/strict'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import fs from 'node:fs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tmp = path.join(root, '.tmp')
fs.mkdirSync(tmp, { recursive: true })

let passed = 0
let failed = 0

async function test(name, fn) {
  try {
    await fn()
    passed += 1
    console.log(`  ok  ${name}`)
  } catch (error) {
    failed += 1
    console.error(`FAIL  ${name}`)
    console.error(error)
  }
}

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port))
  })
}

const sample = {
  config: { siteName: 'Runtime Test' },
  groups: [{ id: 'g', name: 'G', sort: 0, hidden: false }],
  items: [{ id: 'i', groupId: 'g', title: 'I', sort: 0 }],
  searchEngines: [{ id: 'e', name: 'E', url: 'https://e.test?q=' }],
  gallery: [],
}

async function login(origin, password = 'runtime-pass') {
  const response = await fetch(`${origin}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  return { response, body: await response.json() }
}

// ---------------------------------------------------------------------------
// Vercel Node function + mock Upstash Redis
// ---------------------------------------------------------------------------

const vercelOut = path.join(tmp, 'vercel-api.mjs')
await build({
  entryPoints: [path.join(root, 'api/[...path].ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: vercelOut,
  logLevel: 'silent',
  external: ['@vercel/blob'],
})

const redis = new Map()
const redisServer = http.createServer(async (request, response) => {
  if (request.headers.authorization !== 'Bearer test-redis-token') {
    response.writeHead(401, { 'content-type': 'application/json' })
    response.end('{"error":"unauthorized"}')
    return
  }
  const url = new URL(request.url || '/', 'http://redis')
  const match = url.pathname.match(/^\/(get|set|del)\/(.+)$/)
  if (!match) {
    response.writeHead(404)
    response.end('{}')
    return
  }
  const [, command, encodedKey] = match
  const key = decodeURIComponent(encodedKey)
  if (command === 'get') {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ result: redis.get(key) ?? null }))
    return
  }
  if (command === 'set') {
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    redis.set(key, Buffer.concat(chunks).toString('utf8'))
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end('{"result":"OK"}')
    return
  }
  redis.delete(key)
  response.writeHead(200, { 'content-type': 'application/json' })
  response.end('{"result":1}')
})
const redisPort = await listen(redisServer)

process.env.KV_REST_API_URL = `http://127.0.0.1:${redisPort}`
process.env.KV_REST_API_TOKEN = 'test-redis-token'
process.env.ADMIN_PASSWORD = 'runtime-pass'
process.env.SESSION_SECRET = 'runtime-secret'
delete process.env.BLOB_READ_WRITE_TOKEN

const handler = (await import(pathToFileURL(vercelOut).href + `?t=${Date.now()}`)).default
const apiServer = http.createServer((request, response) => {
  void handler(request, response)
})
const apiPort = await listen(apiServer)
const origin = `http://127.0.0.1:${apiPort}`

console.log('\nVercel function (mock Upstash)')

await test('Vercel server modules use ESM .js import specifiers', async () => {
  const files = ['server/core.ts', 'server/vercel.ts', 'server/vercel-node.ts', 'server/sync.ts']
  for (const rel of files) {
    const source = fs.readFileSync(path.join(root, rel), 'utf8')
    const missing = [...source.matchAll(/from ['"](\.[^'"]+)['"]/g)]
      .map((match) => match[1])
      .filter((spec) => !spec.endsWith('.js'))
    assert.deepEqual(missing, [], `${rel} missing .js extensions: ${missing.join(', ')}`)
  }
})

await test('health reports Redis storage without assets', async () => {
  const response = await fetch(`${origin}/api/health`)
  const body = await response.json()
  assert.equal(response.status, 200)
  assert.equal(body.ok, true)
  assert.equal(body.storage, 'redis')
  assert.equal(body.assets, null)
})

await test('health works when Vercel strips the /api prefix', async () => {
  const response = await fetch(`${origin}/health`)
  const body = await response.json()
  assert.equal(response.status, 200)
  assert.equal(body.ok, true)
  assert.equal(body.storage, 'redis')
})

await test('health works when rewritten to /api?__hp=', async () => {
  const response = await fetch(`${origin}/api?__hp=health`)
  const body = await response.json()
  assert.equal(response.status, 200)
  assert.equal(body.ok, true)
  assert.equal(body.storage, 'redis')
})

await test('login + authenticated state round-trip', async () => {
  const { response, body } = await login(origin)
  assert.equal(response.status, 200)
  assert.ok(body.token)

  const put = await fetch(`${origin}/api/state`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${body.token}` },
    body: JSON.stringify({ data: sample }),
  })
  assert.equal(put.status, 200)
  assert.ok(redis.has('hares-panel:state:default'))

  const publicResponse = await fetch(`${origin}/api/state`)
  const publicBody = await publicResponse.json()
  assert.equal(publicBody.data.users, undefined)
  assert.equal(publicBody.data.config.siteName, 'Runtime Test')

  const full = await fetch(`${origin}/api/state?full=1`, {
    headers: { authorization: `Bearer ${body.token}` },
  })
  assert.equal((await full.json()).data.groups.length, 1)
})

await test('asset upload reports a missing Blob configuration', async () => {
  const { body } = await login(origin)
  const form = new FormData()
  form.append('file', new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }), 'a.png')
  const response = await fetch(`${origin}/api/assets`, {
    method: 'POST',
    headers: { authorization: `Bearer ${body.token}` },
    body: form,
  })
  assert.equal(response.status, 503)
})

apiServer.close()
redisServer.close()

// ---------------------------------------------------------------------------
// Cloudflare Worker entry
// ---------------------------------------------------------------------------

const workerOut = path.join(tmp, 'worker-entry.mjs')
await build({
  entryPoints: [path.join(root, 'worker/index.ts')],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outfile: workerOut,
  logLevel: 'silent',
})

const worker = (await import(pathToFileURL(workerOut).href + `?t=${Date.now()}`)).default

function kvMock() {
  const store = new Map()
  return {
    store,
    async get(key) {
      return store.get(key) ?? null
    },
    async put(key, value) {
      store.set(key, value)
    },
  }
}

function r2Mock() {
  const files = new Map()
  return {
    files,
    async put(key, value, options) {
      files.set(key, { bytes: value, type: options?.httpMetadata?.contentType })
    },
    async get(key) {
      const file = files.get(key)
      if (!file) return null
      return {
        async arrayBuffer() {
          return file.bytes.buffer.slice(file.bytes.byteOffset, file.bytes.byteOffset + file.bytes.byteLength)
        },
        httpMetadata: { contentType: file.type },
      }
    },
    async delete(key) {
      files.delete(key)
    },
  }
}

function d1Mock() {
  let row = null
  return {
    prepare(sql) {
      const statement = {
        args: [],
        bind(...values) {
          statement.args = values
          return statement
        },
        async first() {
          return row
        },
        async run() {
          if (sql.startsWith('INSERT')) {
            row = { data: statement.args[1], updated_at: statement.args[2] }
          }
          return { success: true }
        },
      }
      return statement
    },
    getRow: () => row,
  }
}

function assetsMock() {
  return {
    async fetch(request) {
      return new Response(`asset:${new URL(request.url).pathname}`, {
        headers: { 'content-type': 'text/plain' },
      })
    },
  }
}

async function callWorker(env, pathname, init = {}) {
  return worker.fetch(new Request(`https://hares.test${pathname}`, init), env)
}

console.log('\nCloudflare Worker entry')

await test('serves static assets through the ASSETS binding', async () => {
  const response = await callWorker({ ASSETS: assetsMock() }, '/about')
  assert.equal(response.status, 200)
  assert.equal(await response.text(), 'asset:/about')
})

await test('health is unavailable without bindings', async () => {
  const response = await callWorker({ ASSETS: assetsMock() }, '/api/health')
  const body = await response.json()
  assert.equal(body.ok, false)
  assert.equal(body.storage, null)
})

await test('KV storage + R2 assets work end-to-end', async () => {
  const kv = kvMock()
  const r2 = r2Mock()
  const env = {
    ASSETS: assetsMock(),
    HARES_KV: kv,
    HARES_BUCKET: r2,
    ADMIN_PASSWORD: 'worker-pass',
    SESSION_SECRET: 'worker-secret',
  }
  const health = await (await callWorker(env, '/api/health')).json()
  assert.equal(health.ok, true)
  assert.equal(health.storage, 'kv')
  assert.equal(health.assets, 'r2')

  const loginResponse = await callWorker(env, '/api/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: 'worker-pass' }),
  })
  const session = await loginResponse.json()
  assert.equal(loginResponse.status, 200)

  const put = await callWorker(env, '/api/state', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${session.token}` },
    body: JSON.stringify({ data: sample }),
  })
  assert.equal(put.status, 200)
  assert.ok(kv.store.has('hares-panel:state:default'))

  const publicBody = await (await callWorker(env, '/api/state')).json()
  assert.equal(publicBody.data.users, undefined)

  const form = new FormData()
  form.append('file', new Blob([new Uint8Array([9, 8, 7])], { type: 'image/webp' }), 'x.webp')
  const upload = await callWorker(env, '/api/assets', {
    method: 'POST',
    headers: { authorization: `Bearer ${session.token}` },
    body: form,
  })
  const asset = await upload.json()
  assert.equal(upload.status, 201)
  assert.ok(r2.files.has(asset.key))

  const served = await callWorker(env, asset.url)
  assert.equal(served.status, 200)
  assert.deepEqual(new Uint8Array(await served.arrayBuffer()), new Uint8Array([9, 8, 7]))
})

await test('D1 is preferred over KV when both are bound', async () => {
  const d1 = d1Mock()
  const env = {
    ASSETS: assetsMock(),
    HARES_DB: d1,
    HARES_KV: kvMock(),
    ADMIN_PASSWORD: 'worker-pass',
    SESSION_SECRET: 'worker-secret',
  }
  const health = await (await callWorker(env, '/api/health')).json()
  assert.equal(health.storage, 'd1')
  assert.equal(health.ok, true)

  const session = await (
    await callWorker(env, '/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'worker-pass' }),
    })
  ).json()
  const put = await callWorker(env, '/api/state', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${session.token}` },
    body: JSON.stringify({ data: sample }),
  })
  assert.equal(put.status, 200)
  assert.ok(d1.getRow())
  const publicBody = await (await callWorker(env, '/api/state')).json()
  assert.equal(publicBody.data.config.siteName, 'Runtime Test')
})

await test('dashboard-style binding aliases are detected', async () => {
  const env = {
    ASSETS: assetsMock(),
    hares_panel: d1Mock(),
    hares_panel_assets: r2Mock(),
    ADMIN_PASSWORD: 'worker-pass',
    SESSION_SECRET: 'worker-secret',
  }
  const health = await (await callWorker(env, '/api/health')).json()
  assert.equal(health.ok, true)
  assert.equal(health.storage, 'd1')
  assert.equal(health.assets, 'r2')
})

console.log(`\n${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exitCode = 1
