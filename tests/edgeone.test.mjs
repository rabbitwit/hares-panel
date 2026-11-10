/**
 * EdgeOne Makers adapter test with an in-memory Blob store. The real
 * @edgeone/pages-blob SDK is only a thin client; this exercises the same
 * Store surface (get/set/setJSON/delete) and the full API core.
 */
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import fs from 'node:fs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tmp = path.join(root, '.tmp')
fs.mkdirSync(tmp, { recursive: true })

const outfile = path.join(tmp, 'edgeone-api.mjs')
await build({
  stdin: {
    contents: `
      export { handleApi } from './server/core'
      export { createEdgeOneConfig } from './server/edgeone'
    `,
    resolveDir: root,
    sourcefile: 'edgeone-test-entry.ts',
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  outfile,
  logLevel: 'silent',
})
const { handleApi, createEdgeOneConfig } = await import(
  pathToFileURL(outfile).href + `?t=${Date.now()}`
)

const encoder = new TextEncoder()
const decoder = new TextDecoder()

class MockBlobStore {
  constructor() {
    this.objects = new Map()
  }

  async get(key, options = {}) {
    const value = this.objects.get(key)
    if (value === undefined) return null
    if (options.type === 'json') return JSON.parse(decoder.decode(value))
    if (options.type === 'arrayBuffer') {
      return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)
    }
    return decoder.decode(value)
  }

  async set(key, value) {
    if (value instanceof Blob) {
      this.objects.set(key, new Uint8Array(await value.arrayBuffer()))
    } else if (typeof value === 'string') {
      this.objects.set(key, encoder.encode(value))
    } else if (value instanceof ArrayBuffer) {
      this.objects.set(key, new Uint8Array(value))
    } else {
      throw new Error('unsupported mock blob value')
    }
  }

  async setJSON(key, value) {
    this.objects.set(key, encoder.encode(JSON.stringify(value)))
  }

  async delete(key) {
    this.objects.delete(key)
  }
}

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

const store = new MockBlobStore()
const config = createEdgeOneConfig(store, {
  ADMIN_PASSWORD: 'edgeone-pass',
  SESSION_SECRET: 'edgeone-secret',
})

const request = (pathname, init) =>
  handleApi(new Request(`https://hares.edgeone.test${pathname}`, init), config)

const sample = {
  config: { siteName: 'EdgeOne Test' },
  groups: [{ id: 'g', name: 'G', sort: 0, hidden: false, collapsed: false }],
  items: [{ id: 'i', groupId: 'g', title: 'I', sort: 0 }],
  searchEngines: [{ id: 'e', name: 'E', url: 'https://e.test?q=' }],
  gallery: [],
}

console.log('\nEdgeOne Makers adapter')

await test('health reports EdgeOne Blob storage and assets', async () => {
  const response = await request('/api/health')
  const body = await response.json()
  assert.equal(response.status, 200)
  assert.equal(body.ok, true)
  assert.equal(body.runtime, 'edgeone')
  assert.equal(body.storage, 'edgeone-blob')
  assert.equal(body.assets, 'edgeone-blob')
  assert.equal(body.auth, true)
  assert.equal(body.limits.assetBytes, 5 * 1024 * 1024)
})

let token = ''

await test('login and full-state round-trip through Blob', async () => {
  const login = await request('/api/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: 'edgeone-pass' }),
  })
  const session = await login.json()
  assert.equal(login.status, 200)
  assert.ok(session.token)
  token = session.token

  const put = await request('/api/state', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ data: sample }),
  })
  assert.equal(put.status, 200)
  assert.ok(store.objects.has('state/default.json'))

  const publicResponse = await request('/api/state')
  const publicBody = await publicResponse.json()
  assert.equal(publicBody.data.config.siteName, 'EdgeOne Test')
  assert.equal(publicBody.data.users, undefined)

  const full = await request('/api/state?full=1', {
    headers: { authorization: `Bearer ${token}` },
  })
  assert.equal((await full.json()).data.groups.length, 1)
})

let assetUrl = ''

await test('asset upload, serving and delete use the Blob namespace', async () => {
  const form = new FormData()
  form.append('file', new Blob([new Uint8Array([4, 3, 2, 1])], { type: 'image/webp' }), 'x.webp')
  const upload = await request('/api/assets', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: form,
  })
  const asset = await upload.json()
  assert.equal(upload.status, 201)
  assert.match(asset.key, /^icons\/asset-[a-f0-9]+\.webp$/)
  assert.equal(asset.url, `/api/assets/${encodeURIComponent(asset.key)}`)
  assert.ok(store.objects.has(`assets/${asset.key}`))

  assetUrl = asset.url
  const served = await request(assetUrl)
  assert.equal(served.status, 200)
  assert.equal(served.headers.get('content-type'), 'image/webp')
  assert.deepEqual(new Uint8Array(await served.arrayBuffer()), new Uint8Array([4, 3, 2, 1]))

  const deleted = await request(assetUrl, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ url: asset.url }),
  })
  assert.equal(deleted.status, 200)
  assert.equal(store.objects.has(`assets/${asset.key}`), false)
  assert.equal((await request(assetUrl)).status, 404)
})

await test('storage failures surface as unhealthy instead of an empty site', async () => {
  const broken = {
    async get() {
      throw new Error('Blob auth failed')
    },
    async set() {},
    async setJSON() {},
    async delete() {},
  }
  const brokenConfig = createEdgeOneConfig(broken, { ADMIN_PASSWORD: 'edgeone-pass' })
  const health = await handleApi(
    new Request('https://hares.edgeone.test/api/health'),
    brokenConfig,
  )
  const body = await health.json()
  assert.equal(body.ok, false)
  assert.equal(body.storageError, 'storage_unavailable')
})

await test('pins the EdgeOne build environment to Node 24.18.0', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'edgeone.json'), 'utf8'))
  assert.equal(config.nodeVersion, '24.18.0')
  assert.equal(fs.readFileSync(path.join(root, '.nvmrc'), 'utf8').trim(), '24.18.0')
})

console.log(`\n${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exitCode = 1
