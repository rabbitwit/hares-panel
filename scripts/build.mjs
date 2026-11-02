/**
 * Cross-platform build wrapper.
 *
 * On some Windows setups esbuild cannot delete files in the user's %TEMP%
 * directory ("remove ... Access is denied"), which makes `vite build` fail at
 * the esbuild-transpile step. Pointing TEMP/TMP/TMPDIR at a folder inside the
 * project keeps the temporary files on a path the build user controls.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tempDir = path.join(root, '.build-tmp')
fs.mkdirSync(tempDir, { recursive: true })

console.log(`[build] Node ${process.version} (${process.platform} ${process.arch})`)
if (Number(process.versions.node.split('.')[0]) < 24) {
  console.warn(
    '[build] WARNING: EdgeOne build environment should be Node 24.18.0. ' +
      'Set Project Settings -> Node.js Version to 24.18.0 (or use .nvmrc) and redeploy.',
  )
}

const env = {
  ...process.env,
  TEMP: tempDir,
  TMP: tempDir,
  TMPDIR: tempDir,
}

function run(label, script, args) {
  console.log(`\n> ${label}`)
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    stdio: 'inherit',
    env,
  })
  if (result.error) {
    console.error(result.error)
    process.exit(1)
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

run('tsc --noEmit', path.join(root, 'node_modules/typescript/bin/tsc'), ['--noEmit'])
run('vite build', path.join(root, 'node_modules/vite/bin/vite.js'), ['build'])
run('EdgeOne function', path.join(root, 'scripts/build-edgeone.mjs'), [])
