/**
 * Stages a Docker-free fnOS payload under fnos/app/:
 *
 *   runtime/node     Linux x64 Node binary
 *   server/index.mjs bundled self-hosted HTTP server
 *   web/             built SPA
 *
 * Called by fnos/build.cmd and fnos/build.sh before fnpack.
 * Override the Node version with HARES_FNOS_NODE_VERSION (e.g. 24.11.0).
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fnosDir = path.join(root, 'fnos')
const appDir = path.join(fnosDir, 'app')
const cacheDir = path.join(root, '.tmp', 'fnos-node')
const DEFAULT_NODE_VERSION = '24.11.0'

const skipBuild = process.argv.includes('--skip-build')

function log(message) {
  console.log(`[fnos] ${message}`)
}

function fail(message) {
  console.error(`[fnos] ${message}`)
  process.exit(1)
}

function run(label, command, args, cwd = root) {
  log(label)
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: false })
  if (result.error) fail(`${label} failed: ${result.error.message}`)
  if (result.status !== 0) fail(`${label} failed with exit code ${result.status ?? 1}`)
}

function resetDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
}

function resolveNodeVersion() {
  const fromEnv = process.env.HARES_FNOS_NODE_VERSION?.trim()
  if (fromEnv) return fromEnv.replace(/^v/, '')
  const current = process.versions.node
  if (current.startsWith('24.')) return current
  return DEFAULT_NODE_VERSION
}

function tarballName(version) {
  return `node-v${version}-linux-x64.tar.gz`
}

function tarballUrls(version) {
  const name = tarballName(version)
  return [
    `https://npmmirror.com/mirrors/node/v${version}/${name}`,
    `https://nodejs.org/dist/v${version}/${name}`,
  ]
}

function isElf(file) {
  const fd = fs.openSync(file, 'r')
  try {
    const magic = Buffer.alloc(4)
    fs.readSync(fd, magic, 0, 4, 0)
    return magic[0] === 0x7f && magic.toString('ascii', 1, 4) === 'ELF'
  } finally {
    fs.closeSync(fd)
  }
}

async function download(url, dest) {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok || !response.body) {
    throw new Error(`${response.status} ${response.statusText}`)
  }
  await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(dest))
  const size = fs.statSync(dest).size
  if (size < 1024 * 1024) {
    fs.rmSync(dest, { force: true })
    throw new Error(`download too small (${size} bytes)`)
  }
}

async function ensureNodeTarball(version) {
  fs.mkdirSync(cacheDir, { recursive: true })
  const archive = path.join(cacheDir, tarballName(version))
  if (fs.existsSync(archive) && fs.statSync(archive).size > 1024 * 1024) {
    log(`using cached Node ${version}`)
    return archive
  }

  const temp = `${archive}.part`
  let lastError = null
  for (const url of tarballUrls(version)) {
    log(`downloading ${url}`)
    try {
      await download(url, temp)
      fs.renameSync(temp, archive)
      return archive
    } catch (error) {
      lastError = error
      fs.rmSync(temp, { force: true })
      log(`mirror failed: ${error instanceof Error ? error.message : error}`)
    }
  }
  fail(`could not download Node ${version}: ${lastError instanceof Error ? lastError.message : lastError}`)
}

function extractNodeBinary(archive, version, dest) {
  const extractDir = path.join(cacheDir, `node-v${version}-linux-x64`)
  fs.rmSync(extractDir, { recursive: true, force: true })
  log(`extracting ${path.basename(archive)}`)
  const result = spawnSync('tar', ['-xzf', archive, '-C', cacheDir, `${path.basename(extractDir)}/bin/node`], {
    stdio: 'inherit',
  })
  if (result.error) fail(`tar failed: ${result.error.message}`)
  if (result.status !== 0) fail(`tar failed with exit code ${result.status ?? 1}`)

  const extracted = path.join(extractDir, 'bin', 'node')
  if (!fs.existsSync(extracted)) fail(`extracted Node binary not found: ${extracted}`)
  if (!isElf(extracted)) fail('extracted Node binary is not a Linux ELF file')

  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(extracted, dest)
  try {
    fs.chmodSync(dest, 0o755)
  } catch {
    // Windows cannot set POSIX execute bits; cmd/main chmod's on the NAS.
  }
}

function stageApp() {
  const runtimeDir = path.join(appDir, 'runtime')
  const serverDir = path.join(appDir, 'server')
  const webDir = path.join(appDir, 'web')
  const distDir = path.join(root, 'dist')
  const serverBundle = path.join(root, 'server-dist', 'index.mjs')

  if (!fs.existsSync(distDir) || !fs.existsSync(path.join(distDir, 'index.html'))) {
    fail('dist/ is missing; run npm run build:docker first')
  }
  if (!fs.existsSync(serverBundle)) {
    fail('server-dist/index.mjs is missing; run npm run build:docker first')
  }

  resetDir(runtimeDir)
  resetDir(serverDir)
  resetDir(webDir)

  fs.copyFileSync(serverBundle, path.join(serverDir, 'index.mjs'))
  fs.cpSync(distDir, webDir, { recursive: true })

  return path.join(runtimeDir, 'node')
}

const version = resolveNodeVersion()
log(`staging native fnOS payload (Node ${version} linux-x64)`)

run('sync fnOS manifest version', process.execPath, [
  path.join(root, 'scripts', 'sync-fnos-version.mjs'),
])

if (skipBuild) {
  log('skipping app build (--skip-build)')
} else {
  run('build docker bundle', process.execPath, [path.join(root, 'scripts', 'build-docker.mjs')])
}

const nodeDest = stageApp()
const archive = await ensureNodeTarball(version)
extractNodeBinary(archive, version, nodeDest)

log(`runtime: ${path.relative(root, nodeDest)}`)
log(`server:  ${path.relative(root, path.join(appDir, 'server', 'index.mjs'))}`)
log(`web:     ${path.relative(root, path.join(appDir, 'web'))}`)
log('native fnOS payload ready')
