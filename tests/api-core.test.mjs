import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outfile = path.join(root, '.tmp', 'api-core.mjs')

await build({
  entryPoints: [path.join(root, 'server/core.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile,
  logLevel: 'silent',
})

const { handleApi } = await import(pathToFileURL(outfile).href)

const base = 'https://hares-nav.test'
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

function memoryState() {
  let current = null
  return {
    kind: 'kv',
    async getState() {
      return current
    },
    async putState(data) {
      current = { data, updatedAt: 1_700_000_000_000 + Math.floor(Math.random() * 1000) }
      return current.updatedAt
    },
  }
}

function memoryAssets() {
  const files = new Map()
  return {
    kind: 'r2',
    async putAsset(key, bytes, contentType) {
      files.set(key, { bytes, contentType })
      return { key, url: `/api/assets/${key}` }
    },
    async getAsset(key) {
      return files.get(key) ?? null
    },
    async deleteAsset(key) {
      files.delete(key)
    },
  }
}

function makeConfig(overrides = {}) {
  return {
    adminPassword: 'test-password',
    sessionSecret: 'test-secret',
    state: memoryState(),
    assets: memoryAssets(),
    ...overrides,
  }
}

function call(config, pathname, init = {}) {
  return handleApi(new Request(base + pathname, init), config)
}

async function login(config, password = 'test-password', ip = '10.0.0.1') {
  const response = await call(config, '/api/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip },
    body: JSON.stringify({ password }),
  })
  return { response, body: await response.json() }
}

const sampleData = {
  config: {
    siteName: 'Hares-Panel',
    siteTitle: 'Hares-Panel',
    adminName: 'Alice',
    adminAvatar: 'https://example.com/avatar.png',
  },
  groups: [{ id: 'g1', name: '常用', style: 'icon', sort: 0, hidden: false }],
  items: [{ id: 'i1', groupId: 'g1', title: 'Google', url: 'https://google.com', sort: 0 }],
  searchEngines: [{ id: 'e1', name: 'Google', url: 'https://google.com?q=' }],
  gallery: [
    {
      id: 'a1',
      name: 'logo',
      category: 'icon',
      dataUrl: '/api/assets/asset-1.png',
      remoteKey: 'asset-1.png',
      size: 120,
      createdAt: 1,
    },
  ],
}

console.log('\nCloud API core')

await test('health reports unavailable without storage', async () => {
  const response = await call(makeConfig({ state: null, assets: null }), '/api/health')
  const body = await response.json()
  assert.equal(response.status, 200)
  assert.equal(body.ok, false)
  assert.equal(body.storage, null)
})

await test('health reports configured storage and assets', async () => {
  const response = await call(makeConfig(), '/api/health')
  const body = await response.json()
  assert.equal(body.ok, true)
  assert.equal(body.storage, 'kv')
  assert.equal(body.assets, 'r2')
  assert.equal(body.auth, true)
})

function updateConfig(latestVersion = '0.2.0') {
  return makeConfig({
    updateChecker: async () => ({
      latestVersion,
      latestTag: latestVersion,
      image: 'hareswit2265/hares-panel',
      source: 'docker-hub',
      publishedAt: 1_700_000_000_000,
      checkedAt: 1_700_000_001_000,
    }),
  })
}

await test('update endpoint reports a newer release', async () => {
  const response = await call(updateConfig(), '/api/update?current=0.1.1')
  const body = await response.json()
  assert.equal(response.status, 200)
  assert.equal(body.currentVersion, '0.1.1')
  assert.equal(body.latestVersion, '0.2.0')
  assert.equal(body.updateAvailable, true)
  assert.equal(body.image, 'hareswit2265/hares-panel')
  assert.equal(body.source, 'docker-hub')
})

await test('update endpoint treats prereleases as older than the release', async () => {
  const body = await (await call(updateConfig('0.2.0'), '/api/update?current=0.2.0-beta.1')).json()
  assert.equal(body.updateAvailable, true)

  const current = await (await call(updateConfig('0.2.0'), '/api/update?current=0.2.1')).json()
  assert.equal(current.updateAvailable, false)
})

await test('update endpoint reports lookup failures', async () => {
  const config = makeConfig({
    updateChecker: async () => {
      throw new Error('offline')
    },
  })
  const response = await call(config, '/api/update?current=0.1.1')
  const body = await response.json()
  assert.equal(response.status, 502)
  assert.equal(body.error, 'update_check_failed')
})

await test('login rejects a wrong password', async () => {
  const { response, body } = await login(makeConfig(), 'wrong', '10.0.0.2')
  assert.equal(response.status, 401)
  assert.equal(body.error, 'invalid_password')
})

await test('login rejects requests when ADMIN_PASSWORD is missing', async () => {
  const { response, body } = await login(makeConfig({ adminPassword: '' }), 'whatever', '10.0.0.3')
  assert.equal(response.status, 503)
  assert.equal(body.error, 'no_password')
})

await test('login returns a signed token', async () => {
  const { response, body } = await login(makeConfig(), 'test-password', '10.0.0.4')
  assert.equal(response.status, 200)
  assert.match(body.token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
  assert.ok(body.expiresAt > Date.now())
})

await test('session refresh renews a valid token and its expiry', async () => {
  const config = makeConfig({ tokenTtlMs: 60_000 })
  const { body: auth } = await login(config, 'test-password', '10.0.0.10')
  await new Promise((resolve) => setTimeout(resolve, 10))
  const response = await call(config, '/api/session/refresh', {
    method: 'POST',
    headers: { authorization: `Bearer ${auth.token}` },
  })
  const renewed = await response.json()
  assert.equal(response.status, 200)
  assert.match(renewed.token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
  assert.ok(renewed.expiresAt > auth.expiresAt)

  const full = await call(config, '/api/state?full=1', {
    headers: { authorization: `Bearer ${renewed.token}` },
  })
  // The refreshed token passes auth; the empty store still yields 404.
  assert.equal(full.status, 404)
})

await test('session refresh rejects missing or expired tokens', async () => {
  const config = makeConfig({ tokenTtlMs: 30 })
  const { body: auth } = await login(config, 'test-password', '10.0.0.11')
  await new Promise((resolve) => setTimeout(resolve, 50))

  const expired = await call(config, '/api/session/refresh', {
    method: 'POST',
    headers: { authorization: `Bearer ${auth.token}` },
  })
  assert.equal(expired.status, 401)

  const anonymous = await call(config, '/api/session/refresh', { method: 'POST' })
  assert.equal(anonymous.status, 401)
})

await test('state writes require authentication', async () => {
  const config = makeConfig()
  const response = await call(config, '/api/state', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ data: sampleData }),
  })
  assert.equal(response.status, 401)
})

await test('state can be stored and read through the public projection', async () => {
  const config = makeConfig()
  const { body: auth } = await login(config, 'test-password', '10.0.0.5')
  const put = await call(config, '/api/state', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${auth.token}` },
    body: JSON.stringify({ data: sampleData }),
  })
  assert.equal(put.status, 200)

  const publicResponse = await call(config, '/api/state')
  const publicBody = await publicResponse.json()
  assert.equal(publicResponse.status, 200)
  assert.equal(publicBody.data.items.length, 1)
  assert.equal(publicBody.data.users, undefined)
  assert.equal(publicBody.data.config.adminName, undefined)
  assert.equal(publicBody.data.config.adminAvatar, undefined)
  assert.ok(!JSON.stringify(publicBody).includes('passwordHash'))

  const fullUnauthorized = await call(config, '/api/state?full=1')
  assert.equal(fullUnauthorized.status, 401)

  const full = await call(config, '/api/state?full=1', {
    headers: { authorization: `Bearer ${auth.token}` },
  })
  const fullBody = await full.json()
  assert.equal(fullBody.data.groups.length, 1)
  assert.equal(fullBody.data.users, undefined)
  assert.equal(fullBody.data.config.adminName, 'Alice')
  assert.equal(fullBody.data.config.adminAvatar, 'https://example.com/avatar.png')
})

await test('public projection removes hidden cards and hidden groups', async () => {
  const config = makeConfig()
  const { body: auth } = await login(config, 'test-password', '10.0.0.56')
  const hiddenData = {
    ...sampleData,
    groups: [
      { id: 'g1', name: '公开分组', style: 'icon', sort: 0, hidden: false },
      { id: 'g2', name: '秘密分组', style: 'icon', sort: 1, hidden: true },
    ],
    items: [
      { id: 'i1', groupId: 'g1', title: '公开卡片', url: 'https://public.test', sort: 0 },
      { id: 'i2', groupId: 'g1', title: '隐藏卡片', url: 'https://hidden.test', sort: 1, hidden: true },
      { id: 'i3', groupId: 'g2', title: '秘密分组卡片', url: 'https://group.test', sort: 0 },
    ],
  }
  const put = await call(config, '/api/state', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${auth.token}` },
    body: JSON.stringify({ data: hiddenData }),
  })
  assert.equal(put.status, 200)

  const publicResponse = await call(config, '/api/state')
  const publicBody = await publicResponse.json()
  assert.equal(publicBody.data.groups.length, 1)
  assert.equal(publicBody.data.groups[0].id, 'g1')
  assert.equal(publicBody.data.items.length, 1)
  assert.equal(publicBody.data.items[0].id, 'i1')
  const serialized = JSON.stringify(publicBody)
  assert.ok(!serialized.includes('隐藏卡片'))
  assert.ok(!serialized.includes('秘密分组'))
  assert.ok(!serialized.includes('hidden.test'))
  assert.ok(!serialized.includes('group.test'))

  const full = await call(config, '/api/state?full=1', {
    headers: { authorization: `Bearer ${auth.token}` },
  })
  const fullBody = await full.json()
  assert.equal(fullBody.data.groups.length, 2)
  assert.equal(fullBody.data.items.length, 3)
})

await test('legacy account records are stripped on write and read', async () => {
  const config = makeConfig()
  const { body: auth } = await login(config, 'test-password', '10.0.0.55')
  const legacy = {
    ...sampleData,
    config: { ...sampleData.config, defaultOpenMode: 'window' },
    items: [
      {
        ...sampleData.items[0],
        openMode: 'window',
        windowWidth: 900,
        windowHeight: 600,
      },
    ],
    users: [{ id: 'u1', account: 'admin', passwordHash: 'deadbeefdeadbeef', salt: 'salt' }],
  }
  const put = await call(config, '/api/state', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${auth.token}` },
    body: JSON.stringify({ data: legacy }),
  })
  assert.equal(put.status, 200)

  const full = await call(config, '/api/state?full=1', {
    headers: { authorization: `Bearer ${auth.token}` },
  })
  const fullBody = await full.json()
  assert.equal(fullBody.data.users, undefined)
  assert.ok(!JSON.stringify(fullBody).includes('deadbeef'))
  assert.equal(fullBody.data.config.defaultOpenMode, 'new')
  assert.equal(fullBody.data.items[0].openMode, 'new')
  assert.equal(fullBody.data.items[0].windowWidth, undefined)
  assert.equal(fullBody.data.items[0].windowHeight, undefined)

  const publicBody = await (await call(config, '/api/state')).json()
  assert.equal(publicBody.data.users, undefined)
  assert.equal(publicBody.data.items[0].openMode, 'new')
})

await test('public projection hides content when publicAccess is false', async () => {
  const config = makeConfig()
  const { body: auth } = await login(config, 'test-password', '10.0.0.61')
  const lockedData = {
    ...sampleData,
    config: { ...sampleData.config, publicAccess: false },
  }
  const put = await call(config, '/api/state', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${auth.token}` },
    body: JSON.stringify({ data: lockedData }),
  })
  assert.equal(put.status, 200)

  const publicResponse = await call(config, '/api/state')
  const publicBody = await publicResponse.json()
  assert.equal(publicBody.locked, true)
  assert.equal(publicBody.data.config.publicAccess, false)
  assert.equal(publicBody.data.groups.length, 0)
  assert.equal(publicBody.data.items.length, 0)
  assert.equal(publicBody.data.users, undefined)
  assert.equal(publicBody.data.config.adminName, undefined)
  assert.equal(publicBody.data.config.adminAvatar, undefined)

  const full = await call(config, '/api/state?full=1', {
    headers: { authorization: `Bearer ${auth.token}` },
  })
  const fullBody = await full.json()
  assert.equal(fullBody.data.groups.length, 1)
  assert.equal(fullBody.data.config.publicAccess, false)
})

await test('state rejects malformed payloads', async () => {
  const config = makeConfig()
  const { body: auth } = await login(config, 'test-password', '10.0.0.6')
  const response = await call(config, '/api/state', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${auth.token}` },
    body: JSON.stringify({ data: { config: {} } }),
  })
  assert.equal(response.status, 400)
})

await test('state returns 404 before the first upload', async () => {
  const config = makeConfig()
  const response = await call(config, '/api/state')
  assert.equal(response.status, 404)
})

await test('tampered tokens are rejected', async () => {
  const config = makeConfig()
  const { body: auth } = await login(config, 'test-password', '10.0.0.7')
  const [payload, signature] = auth.token.split('.')
  const tampered = `${payload}.${signature.slice(0, -2)}xx`
  const response = await call(config, '/api/state', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${tampered}` },
    body: JSON.stringify({ data: sampleData }),
  })
  assert.equal(response.status, 401)
})

await test('image upload requires auth and returns a public URL', async () => {
  const config = makeConfig()
  const unauthorized = await call(config, '/api/assets', {
    method: 'POST',
    body: new FormData(),
  })
  assert.equal(unauthorized.status, 401)

  const { body: auth } = await login(config, 'test-password', '10.0.0.8')
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
  const form = new FormData()
  form.append('file', new Blob([bytes], { type: 'image/png' }), 'logo.png')
  const upload = await call(config, '/api/assets', {
    method: 'POST',
    headers: { authorization: `Bearer ${auth.token}` },
    body: form,
  })
  const uploaded = await upload.json()
  assert.equal(upload.status, 201)
  assert.match(uploaded.key, /^asset-[a-f0-9]+\.png$/)
  assert.equal(uploaded.url, `/api/assets/${uploaded.key}`)
  assert.equal(uploaded.size, bytes.length)

  const served = await call(config, uploaded.url)
  assert.equal(served.status, 200)
  assert.equal(served.headers.get('content-type'), 'image/png')
  assert.equal(served.headers.get('cache-control'), 'public, max-age=31536000, immutable')
  assert.deepEqual(new Uint8Array(await served.arrayBuffer()), bytes)

  const removed = await call(config, uploaded.url, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${auth.token}` },
    body: JSON.stringify({ url: uploaded.url }),
  })
  assert.equal(removed.status, 200)
  assert.equal((await call(config, uploaded.url)).status, 404)
})

await test('image upload rejects unsupported types', async () => {
  const config = makeConfig()
  const { body: auth } = await login(config, 'test-password', '10.0.0.9')
  const form = new FormData()
  form.append('file', new Blob(['hello'], { type: 'text/plain' }), 'note.txt')
  const response = await call(config, '/api/assets', {
    method: 'POST',
    headers: { authorization: `Bearer ${auth.token}` },
    body: form,
  })
  assert.equal(response.status, 415)
})

await test('login is rate limited per IP', async () => {
  const config = makeConfig()
  let last = null
  for (let index = 0; index < 9; index += 1) {
    last = await login(config, 'wrong', '203.0.113.9')
  }
  assert.equal(last.response.status, 429)
})

await test('unknown API routes return JSON 404', async () => {
  const response = await call(makeConfig(), '/api/unknown')
  assert.equal(response.status, 404)
  assert.equal((await response.json()).error, 'not_found')
})

console.log(`\n${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exitCode = 1
