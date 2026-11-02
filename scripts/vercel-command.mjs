/**
 * Cross-platform command wrapper for Vercel's install/build steps.
 *
 * Vercel's build image exports `NPM_CONFIG_CACHE_DIR`, which npm reports as
 * `npm warn Unknown env config "cache-dir"` on every invocation. The setting
 * is not a real npm option (npm uses `cache`), so translate it to npm's actual
 * `cache` option before spawning. This keeps the cache path Vercel intended
 * while avoiding the warning.
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const [command, ...args] = process.argv.slice(2)
if (!command) {
  console.error('usage: node scripts/vercel-command.mjs <command> [...args]')
  process.exit(1)
}

const env = { ...process.env }
for (const key of Object.keys(env)) {
  if (/^npm_config_cache[_-]dir$/i.test(key)) {
    const cacheDir = env[key]
    delete env[key]
    if (cacheDir) {
      env.npm_config_cache = cacheDir
    }
  }
}

// npm.cmd cannot be spawned directly on Windows, and `shell: true` also emits
// Node's DEP0190 deprecation warning. Resolve cmd.exe explicitly instead.
const quoteCmdArg = (value) =>
  /[\s"&|<>^]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value

const result =
  process.platform === 'win32'
    ? spawnSync(
        process.env.ComSpec ||
          path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'cmd.exe'),
        ['/d', '/s', '/c', [command, ...args].map(quoteCmdArg).join(' ')],
        { cwd: process.cwd(), env, stdio: 'inherit' },
      )
    : spawnSync(command, args, {
        cwd: process.cwd(),
        env,
        stdio: 'inherit',
      })

if (result.error) {
  console.error(result.error)
  process.exit(1)
}

process.exit(result.status ?? 1)
