/**
 * Keep the fnOS package manifest version in sync with package.json.
 * fnpack reads fnos/manifest, so the build scripts call this before packaging.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const manifestPath = path.join(root, 'fnos', 'manifest')
const manifest = fs.readFileSync(manifestPath, 'utf8')
const next = manifest.replace(/^version=.*$/m, `version=${version}`)

if (next !== manifest) {
  fs.writeFileSync(manifestPath, next)
  console.log(`[fnos] manifest version -> ${version}`)
}
