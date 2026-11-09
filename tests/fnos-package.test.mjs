/**
 * Static checks for the native fnOS package: it must not declare a Docker
 * project or shell out to docker, and the launcher / privilege files must exist.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fnos = path.join(root, 'fnos')

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    passed += 1
    console.log(`  ok  ${name}`)
  } catch (error) {
    failed += 1
    console.error(`FAIL  ${name}`)
    console.error(error)
  }
}

function read(relative) {
  return fs.readFileSync(path.join(fnos, relative), 'utf8')
}

console.log('\nfnOS native package')

test('does not ship a docker-compose project', () => {
  assert.equal(fs.existsSync(path.join(fnos, 'app/docker/docker-compose.yaml')), false)
  const resource = JSON.parse(read('config/resource'))
  assert.equal(resource['docker-project'], undefined)
})

test('privilege uses a non-docker package user', () => {
  const privilege = JSON.parse(read('config/privilege'))
  assert.equal(privilege.username, 'hares-panel')
  assert.equal(privilege.groupname, 'hares-panel')
  assert.notEqual(privilege.username.startsWith('docker-'), true)
})

test('cmd/main manages a native process instead of Docker', () => {
  const main = read('cmd/main')
  assert.match(main, /\bstart\)/)
  assert.match(main, /\bstop\)/)
  assert.match(main, /\bstatus\)/)
  assert.equal(/docker\s/i.test(main), false)
  assert.match(main, /bin\/hares-panel/)
})

test('cmd/main follows official fnOS env and start contract', () => {
  const main = read('cmd/main')
  assert.match(main, /TRIM_APPDEST/)
  assert.match(main, /TRIM_PKGVAR/)
  assert.match(main, /TRIM_SERVICE_PORT/)
  assert.match(main, /TRIM_TEMP_LOGFILE/)
  assert.match(main, /exit 3/)
  assert.match(main, /is_listening/)
  assert.match(main, /wait_for_ready/)
  assert.equal(/TRIM_APP \/ TRIM_PKGVAR is not set/.test(main), false)
})

test('launcher execs the bundled Node server', () => {
  const launcher = read('app/bin/hares-panel')
  assert.match(launcher, /HARES_RUNTIME="\$\{HARES_RUNTIME:-fnos\}"/)
  assert.match(launcher, /TRIM_APPDEST/)
  assert.match(launcher, /runtime\/node/)
  assert.match(launcher, /server\/index\.mjs/)
  assert.match(launcher, /exec "\$NODE"/)
  assert.equal(/docker\s/i.test(launcher), false)
})

test('manifest still exposes port 18000', () => {
  const manifest = read('manifest')
  assert.match(manifest, /^service_port=18000$/m)
  assert.match(manifest, /^platform=x86$/m)
})

test('prepare-fnos script exists and downloads linux-x64 Node', () => {
  const script = fs.readFileSync(path.join(root, 'scripts/prepare-fnos.mjs'), 'utf8')
  assert.match(script, /linux-x64/)
  assert.match(script, /runtime/)
  assert.equal(script.includes('docker-compose'), false)
})

if (failed) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}
console.log(`\n${passed} passed`)
