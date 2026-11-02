/**
 * Generates a compact offline icon subset from the installed Iconify JSON packages.
 * Run with: node scripts/build-icon-subset.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const logosWanted = [
  'google-icon', 'github-icon', 'youtube', 'visual-studio-code', 'vercel-icon', 'cloudflare-icon',
  'docker-icon', 'figma', 'netflix-icon', 'spotify-icon', 'bing', 'duckduckgo', 'apple', 'microsoft-icon',
  'linux-tux', 'android-icon', 'ubuntu', 'debian', 'nginx', 'chrome', 'firefox', 'brave',
  'postman-icon', 'slack-icon', 'notion-icon', 'openai-icon', 'discord-icon', 'telegram',
  'wordpress-icon', 'react', 'vue', 'svelte-icon', 'angular-icon', 'nextjs-icon', 'nodejs-icon',
  'python', 'rust', 'go', 'java', 'typescript-icon', 'javascript', 'tailwindcss-icon', 'vitejs',
  'raspberry-pi', 'home-assistant-icon', 'proxmox', 'unraid', 'truenas', 'synology', 'plex',
  'jellyfin', 'emby', 'grafana', 'prometheus', 'kubernetes', 'gitlab', 'gitea', 'jenkins',
  'nginx', 'apache', 'mysql', 'postgresql', 'redis', 'mongodb', 'sqlite', 'rabbitmq',
  'steam', 'epic-games', 'xbox', 'playstation', 'nintendo-switch', 'spotify',
  'bilibili', 'twitch', 'netflix', 'hulu', 'disney-plus', 'prime-video',
  'icloud', 'dropbox', 'google-drive', 'onedrive', 'mega', 'nextcloud',
  'synology', 'qnap', 'openwrt', 'mikrotik', 'ubiquiti', 'unifi',
]

const simpleWanted = [
  'bilibili', 'openai', 'baidu', 'homeassistant', 'jellyfin', 'nextcloud', 'qbittorrent',
  'synology', 'immich', 'openwrt', 'portainer', 'excalidraw', 'emby', 'plex',
  'googlechrome', 'firefox', 'brave', 'duckduckgo', 'bing', 'microsoftbing', 'kagi', 'startpage',
  'apple', 'android', 'linux', 'ubuntu', 'debian', 'archlinux', 'fedora', 'raspberrypi',
  'nginx', 'apache', 'mysql', 'postgresql', 'redis', 'mongodb', 'sqlite', 'rabbitmq',
  'git', 'github', 'gitlab', 'gitea', 'jenkins', 'kubernetes', 'docker', 'podman',
  'ansible', 'terraform', 'grafana', 'prometheus', 'proxmox', 'unraid', 'truenas',
  'wordpress', 'notion', 'obsidian', 'excalidraw', 'figma', 'canva', 'affinity',
  'slack', 'discord', 'telegram', 'wechat', 'qq', 'alipay', 'taobao', 'jd', 'douban', 'zhihu',
  'youtube', 'twitch', 'netflix', 'spotify', 'soundcloud', 'steam', 'epicgames', 'playstation',
  'xbox', 'nintendoswitch', 'emby', 'plex', 'jellyfin', 'kodi', 'vlcmediaplayer',
  'nodejs', 'nodedotjs', 'bun', 'deno', 'python', 'rust', 'go', 'java', 'typescript',
  'javascript', 'react', 'vuedotjs', 'angular', 'svelte', 'nextdotjs', 'nuxtdotjs', 'tailwindcss',
  'vite', 'webpack', 'eslint', 'prettier', 'npm', 'pnpm', 'yarn', 'vercel', 'netlify',
  'cloudflare', 'cloudflareworkers', 'supabase', 'firebase', 'prisma', 'drizzle',
  'visualstudiocode', 'intellijidea', 'vim', 'neovim', 'sublimetext', 'git',
  'windows', 'apple', 'linux', 'android', 'ios',
  'steam', 'spotify', 'youtube', 'bilibili',
]

/**
 * Follows an alias chain until it reaches a real icon in the upstream set.
 * Returns the resolved base icon name, or null when the chain is broken.
 */
function resolveAliasBase(source, name, depth = 0) {
  const alias = source.aliases?.[name]
  if (!alias || depth > 4) return null
  if (source.icons[alias.parent]) return alias.parent
  return resolveAliasBase(source, alias.parent, depth + 1)
}

function build(prefix, wanted) {
  const source = JSON.parse(
    fs.readFileSync(path.resolve(`node_modules/@iconify-json/${prefix}/icons.json`), 'utf8'),
  )
  const icons = {}
  const aliases = {}
  for (const name of [...new Set(wanted)]) {
    if (source.icons[name]) {
      icons[name] = source.icons[name]
      continue
    }
    const base = resolveAliasBase(source, name)
    if (!base) continue
    // The alias target must be part of the subset, otherwise Iconify rejects
    // the whole collection and every icon is fetched from the API instead.
    icons[base] = source.icons[base]
    aliases[name] = { ...source.aliases[name], parent: base }
  }
  return {
    prefix,
    width: source.width ?? 24,
    height: source.height ?? 24,
    icons,
    ...(Object.keys(aliases).length ? { aliases } : {}),
  }
}

const out = [build('logos', logosWanted), build('simple-icons', simpleWanted)]
fs.writeFileSync(path.resolve('src/data/icon-subset.json'), JSON.stringify(out))
const counts = out.map((c) => `${c.prefix}: ${Object.keys(c.icons).length}`).join(', ')
console.log(`Generated icon subset (${counts})`)
