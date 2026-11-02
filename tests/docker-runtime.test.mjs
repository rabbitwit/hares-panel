/**
 * Exercises the self-hosted Node runtime used by the Docker image:
 * file-backed state/assets, login + token persistence, SPA static serving and
 * the bundled HTTP API.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tmp = path.join(root, '.tmp')
fs.mkdirSync(tmp, { recursive: true })
const outfile = path.join(tmp, 'docker-runtime.mjs')

await build({
  stdin: {
    contents: [
      "export { createFileRuntime } from './server/file'",
      "export { createHaresServer } from './server/main'",
    ].join('\n'),
    resolveDir: root,
    sourcefile: 'docker-runtime-entry.ts',
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile,
  logLevel: 'silent',
  tsconfig: path.join(root, 'tsconfig.json'),
})

const { createFileRuntime, createHaresServer } = await import(
  pathToFileURL(outfile).href + `?t=${Date.now()}`
)

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

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hares-docker-runtime-'))
const dataDir = path.join(workDir, 'data')
const staticDir = path.join(workDir, 'site')
fs.mkdirSync(path.join(staticDir, 'assets'), { recursive: true })
fs.writeFileSync(path.join(staticDir, 'index.html'), '<!doctype html><title>Hares SPA</title>')
fs.writeFileSync(path.join(staticDir, 'assets', 'app.js'), 'console.log("hares")')

const sample = {
  config: { siteName: 'Docker Runtime', siteTitle: 'Docker Runtime' },
  groups: [{ id: 'g', name: 'G', sort: 0, hidden: false }],
  items: [{ id: 'i', groupId: 'g', title: 'I', sort: 0 }],
  searchEngines: [{ id: 'e', name: 'E', url: 'https://e.test?q=' }],
  gallery: [],
}

async function start() {
  const runtime = await createFileRuntime({
    HARES_DATA_DIR: dataDir,
    ADMIN_PASSWORD: 'docker-pass',
    HARES_RUNTIME: 'docker',
  })
  const server = createHaresServer({ runtime, staticDir })
  const port = await listen(server)
  return { server, runtime, origin: `http://127.0.0.1:${port}` }
}

async function login(origin, password = 'docker-pass') {
  const response = await fetch(`${origin}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  return { response, body: await response.json() }
}

const first = await start()
console.log('\nDocker / self-hosted Node runtime')

await test('health reports file storage and configured auth', async () => {
  const response = await fetch(`${first.origin}/api/health`)
  const body = await response.json()
  assert.equal(response.status, 200)
  assert.equal(body.ok, true)
  assert.equal(body.storage, 'file')
  assert.equal(body.assets, 'file')
  assert.equal(body.runtime, 'docker')
  assert.equal(body.auth, true)
})

await test('serves the SPA shell and static assets', async () => {
  const home = await fetch(`${first.origin}/`)
  assert.equal(home.status, 200)
  assert.match(await home.text(), /Hares SPA/)

  const route = await fetch(`${first.origin}/dashboard`, { headers: { accept: 'text/html' } })
  assert.equal(route.status, 200)
  assert.match(await route.text(), /Hares SPA/)

  const asset = await fetch(`${first.origin}/assets/app.js`)
  assert.equal(asset.status, 200)
  assert.equal(asset.headers.get('content-type'), 'text/javascript; charset=utf-8')
  assert.match(asset.headers.get('cache-control') || '', /immutable/)

  const missing = await fetch(`${first.origin}/missing.js`)
  assert.equal(missing.status, 404)

  const traversal = await fetch(`${first.origin}/%2e%2e/package.json`)
  assert.equal(traversal.status, 404)
})

await test('rejects a wrong password and accepts the runtime password', async () => {
  const wrong = await login(first.origin, 'not-the-password')
  assert.equal(wrong.response.status, 401)

  const correct = await login(first.origin)
  assert.equal(correct.response.status, 200)
  assert.ok(correct.body.token)
})

await test('persists state to data/state.json and protects full state', async () => {
  const { body } = await login(first.origin)
  const put = await fetch(`${first.origin}/api/state`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${body.token}` },
    body: JSON.stringify({ data: sample }),
  })
  assert.equal(put.status, 200)

  const stored = JSON.parse(fs.readFileSync(path.join(dataDir, 'state.json'), 'utf8'))
  assert.equal(stored.data.config.siteName, 'Docker Runtime')
  assert.ok(typeof stored.updatedAt === 'number')

  const publicResponse = await fetch(`${first.origin}/api/state`)
  const publicBody = await publicResponse.json()
  assert.equal(publicBody.data.config.siteName, 'Docker Runtime')
  assert.equal(publicBody.data.groups.length, 1)

  const forbidden = await fetch(`${first.origin}/api/state?full=1`)
  assert.equal(forbidden.status, 401)

  const full = await fetch(`${first.origin}/api/state?full=1`, {
    headers: { authorization: `Bearer ${body.token}` },
  })
  assert.equal(full.status, 200)
  assert.equal((await full.json()).data.items.length, 1)
})

await test('uploads, serves and deletes file-backed assets', async () => {
  const { body } = await login(first.origin)
  const form = new FormData()
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
  form.append('file', new Blob([bytes], { type: 'image/png' }), 'logo.png')
  const upload = await fetch(`${first.origin}/api/assets`, {
    method: 'POST',
    headers: { authorization: `Bearer ${body.token}` },
    body: form,
  })
  const asset = await upload.json()
  assert.equal(upload.status, 201)
  assert.ok(fs.existsSync(path.join(dataDir, 'assets', asset.key)))

  const served = await fetch(`${first.origin}${asset.url}`)
  assert.equal(served.status, 200)
  assert.equal(served.headers.get('content-type'), 'image/png')
  assert.deepEqual(new Uint8Array(await served.arrayBuffer()), bytes)

  const traversal = await fetch(`${first.origin}/api/assets/..%2Fstate.json`)
  assert.equal(traversal.status, 400)

  const removed = await fetch(`${first.origin}${asset.url}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${body.token}` },
    body: '{}',
  })
  assert.equal(removed.status, 200)
  assert.equal(fs.existsSync(path.join(dataDir, 'assets', asset.key)), false)
  assert.equal((await fetch(`${first.origin}${asset.url}`)).status, 404)
})

await test('persists the session secret and data across a restart', async () => {
  const { body } = await login(first.origin)
  await close(first.server)

  const second = await start()
  try {
    const health = await (await fetch(`${second.origin}/api/health`)).json()
    assert.equal(health.ok, true)

    const refreshed = await fetch(`${second.origin}/api/state?full=1`, {
      headers: { authorization: `Bearer ${body.token}` },
    })
    assert.equal(refreshed.status, 200)
    assert.equal((await refreshed.json()).data.config.siteName, 'Docker Runtime')

    const publicBody = await (await fetch(`${second.origin}/api/state`)).json()
    assert.equal(publicBody.data.groups.length, 1)
  } finally {
    await close(second.server)
    fs.rmSync(workDir, { recursive: true, force: true })
  }
})

console.log(`\n${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exitCode = 1
