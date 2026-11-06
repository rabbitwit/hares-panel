/**
 * Cross-instance sync tests.
 *
 * Two in-memory Hares-Panel instances (local + remote) are wired together with
 * a fake `fetch` that routes `/api/*` calls to the remote instance's handler.
 * This exercises the `/api/sync` route and `server/sync.ts` logic end to end,
 * including auto / upload / download direction and asset transfer.
 */

import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outfile = path.join(root, '.tmp', 'sync-core.mjs')

await build({
  entryPoints: [path.join(root, 'server/core.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile,
  logLevel: 'silent',
})

const { handleApi } = await import(pathToFileURL(outfile).href)

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

function memoryState(initial = null) {
  let current = initial
  return {
    kind: 'kv',
    async getState() {
      return current
    },
    async putState(data) {
      const updatedAt = Date.now()
      current = { data, updatedAt }
      return updatedAt
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

/** Fetcher that dispatches every request to the remote instance handler. */
function makeRemoteFetcher(remoteConfig) {
  // The sync code already builds the full remote URL, and handleApi routes only
  // on the pathname, so forward the request (and its body) unchanged.
  return (input, init = {}) =>
    handleApi(new Request(typeof input === 'string' ? input : input.url, init), remoteConfig)
}

const sampleData = {
  config: {
    siteName: 'Hares-Panel',
    siteTitle: 'Hares-Panel',
    adminName: 'Alice',
    defaultOpenMode: 'new',
  },
  groups: [{ id: 'g1', name: '常用', style: 'icon', sort: 0, hidden: false }],
  items: [{ id: 'i1', groupId: 'g1', title: 'Google', url: 'https://google.com', sort: 0, openMode: 'new' }],
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

function localConfig(initial = null) {
  return makeConfig({ state: memoryState(initial) })
}

async function runSync(local, remote, body) {
  const loginResp = await handleApi(new Request('https://local.test/api/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: 'test-password' }),
  }), local)
  const { token } = await loginResp.json()

  const fetchImpl = makeRemoteFetcher(remote)
  const response = await handleApi(new Request('https://local.test/api/sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  }), {
    ...local,
    syncFetch: fetchImpl,
  })
  return { status: response.status, body: await response.json() }
}

console.log('\nCloud sync')

await test('auto sync uploads when local is newer', async () => {
  const localData = {
    ...sampleData,
    config: { ...sampleData.config, siteName: 'Local Site' },
  }
  const local = localConfig({ data: localData, updatedAt: 2_000_000_000_000 })
  const remote = localConfig({ data: sampleData, updatedAt: 1_000_000_000_000 })
  const { status, body } = await runSync(local, remote, {
    remoteUrl: 'https://remote.test',
    password: 'test-password',
    mode: 'auto',
  })
  assert.equal(status, 200)
  assert.equal(body.ok, true)
  assert.equal(body.direction, 'upload')
  // The remote already holds the same asset id, so it is re-used, not re-uploaded.
  assert.equal(body.assets.existing, 1)
})

await test('auto sync downloads when remote is newer', async () => {
  const remoteData = {
    ...sampleData,
    config: { ...sampleData.config, siteName: 'Remote Site' },
  }
  const local = localConfig({ data: sampleData, updatedAt: 1_000_000_000_000 })
  const remote = localConfig({ data: remoteData, updatedAt: 2_000_000_000_000 })
  const { status, body } = await runSync(local, remote, {
    remoteUrl: 'https://remote.test',
    password: 'test-password',
    mode: 'auto',
  })
  assert.equal(status, 200)
  assert.equal(body.ok, true)
  assert.equal(body.direction, 'download')
  const stored = await local.state.getState()
  assert.equal(stored.data.config.siteName, 'Remote Site')
})

await test('auto sync reports none when documents match', async () => {
  const local = localConfig({ data: sampleData, updatedAt: 2_000_000_000_000 })
  const remote = localConfig({ data: sampleData, updatedAt: 1_000_000_000_000 })
  const { status, body } = await runSync(local, remote, {
    remoteUrl: 'https://remote.test',
    password: 'test-password',
    mode: 'auto',
  })
  assert.equal(status, 200)
  assert.equal(body.direction, 'none')
})

await test('forced upload overwrites a newer remote', async () => {
  const local = localConfig({ data: sampleData, updatedAt: 1_000_000_000_000 })
  const remote = localConfig({
    data: { ...sampleData, config: { ...sampleData.config, siteName: 'Newer Remote' } },
    updatedAt: 2_000_000_000_000,
  })
  const { status, body } = await runSync(local, remote, {
    remoteUrl: 'https://remote.test',
    password: 'test-password',
    mode: 'upload',
  })
  assert.equal(status, 200)
  assert.equal(body.direction, 'upload')
  const stored = await remote.state.getState()
  assert.equal(stored.data.config.siteName, 'Hares-Panel')
})

await test('test action validates remote without writing', async () => {
  const local = localConfig({ data: sampleData, updatedAt: 2_000_000_000_000 })
  const remote = localConfig({ data: sampleData, updatedAt: 1_000_000_000_000 })
  const { status, body } = await runSync(local, remote, {
    remoteUrl: 'https://remote.test',
    password: 'test-password',
    mode: 'auto',
    action: 'test',
  })
  assert.equal(status, 200)
  assert.equal(body.action, 'test')
  assert.equal(body.direction, 'none')
  assert.equal(body.ok, true)
})

await test('sync rejects a wrong remote password', async () => {
  const local = localConfig({ data: sampleData, updatedAt: 2_000_000_000_000 })
  const remote = localConfig({ data: sampleData, updatedAt: 1_000_000_000_000 })
  const { status, body } = await runSync(local, remote, {
    remoteUrl: 'https://remote.test',
    password: 'wrong-password',
  })
  assert.equal(status, 401)
  assert.equal(body.error, 'remote_auth_failed')
})

await test('sync requires a remote URL and password', async () => {
  const local = localConfig({ data: sampleData, updatedAt: 2_000_000_000_000 })
  const remote = localConfig({ data: sampleData, updatedAt: 1_000_000_000_000 })
  const { status, body } = await runSync(local, remote, { password: 'test-password' })
  assert.equal(status, 400)
  assert.equal(body.error, 'remote_url_required')
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)