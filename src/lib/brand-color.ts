import subset from '@/data/icon-subset.json'

/**
 * Brand primary colours for the bundled icon set.
 *
 * Solid-style cards fill with the brand colour, so the value has to be the
 * colour people recognise the service by. The bundled iconify data carries no
 * colour metadata and `simple-icons` is monochrome, so deriving it from the SVG
 * alone picks up whatever shape happens to be largest (Google's yellow ring,
 * Tux's beak) rather than the brand. Hence this table; icons missing from it
 * fall back to the dominant fill, and then to the title hash.
 *
 * Keys are the icon name with any collection prefix and `-icon` suffix removed,
 * which makes the entry apply to `logos:x`, `simple-icons:x` and `x-icon`
 * alike.
 */
const brandColors: Record<string, string> = {
  // Search / browsers
  'google-icon': '#4285f4',
  google: '#4285f4',
  googlechrome: '#4285f4',
  chrome: '#4285f4',
  bing: '#258ffa',
  microsoftbing: '#258ffa',
  duckduckgo: '#de5833',
  firefox: '#ff7139',
  brave: '#fb542b',
  kagi: '#ffb319',
  startpage: '#6573ff',

  // Platforms / apps
  youtube: '#ff0000',
  twitch: '#9146ff',
  netflix: '#e50914',
  spotify: '#1db954',
  soundcloud: '#ff5500',
  steam: '#171a21',
  dropbox: '#0061ff',
  'google-drive': '#0f9d58',
  github: '#181717',
  'github-icon': '#181717',
  gitlab: '#fc6d26',
  git: '#f05032',
  gitea: '#609926',
  notion: '#000000',
  'notion-icon': '#000000',
  openai: '#412991',
  'openai-icon': '#412991',
  slack: '#4a154b',
  'slack-icon': '#4a154b',
  discord: '#5865f2',
  'discord-icon': '#5865f2',
  telegram: '#26a5e4',
  wechat: '#07c160',
  qq: '#12b7f5',
  alipay: '#1677ff',
  taobao: '#ff5000',
  douban: '#007722',
  zhihu: '#0084ff',
  bilibili: '#00a1d6',
  baidu: '#2932e1',
  obsidian: '#7c3aed',
  canva: '#00c4cc',
  affinity: '#1b72be',
  figma: '#f24e1e',
  wordpress: '#21759b',
  'wordpress-icon': '#21759b',
  postman: '#ff6c37',
  'postman-icon': '#ff6c37',
  excalidraw: '#6965db',
  kodi: '#17b2e7',
  vlcmediaplayer: '#ff8800',
  epicgames: '#313131',
  playstation: '#003791',
  xbox: '#107c10',
  nintendoswitch: '#e60012',
  emby: '#52b54b',
  plex: '#e5a00d',
  jellyfin: '#00a4dc',
  homeassistant: '#18bcf2',
  immich: '#4250af',
  nextcloud: '#0082c9',
  qbittorrent: '#2f67ba',
  synology: '#b5b5b6',
  openwrt: '#00b5e2',
  portainer: '#13bef9',

  // Infra
  docker: '#2496ed',
  'docker-icon': '#2496ed',
  podman: '#892ca0',
  kubernetes: '#326ce5',
  jenkins: '#d24939',
  ansible: '#ee0000',
  terraform: '#7b42bc',
  proxmox: '#e57000',
  unraid: '#f15a2b',
  truenas: '#0095d5',
  grafana: '#f46800',
  prometheus: '#e6522c',
  nginx: '#009639',
  apache: '#d22128',
  'apache-http': '#d22128',
  mysql: '#4479a1',
  postgresql: '#4169e1',
  redis: '#dc382d',
  mongodb: '#47a248',
  sqlite: '#003b57',
  rabbitmq: '#ff6600',
  visualstudiocode: '#007acc',
  'visual-studio-code': '#007acc',
  intellijidea: '#000000',
  vim: '#019733',
  neovim: '#57a143',
  sublimetext: '#ff9800',

  // Cloud
  cloudflare: '#f38020',
  'cloudflare-icon': '#f38020',
  cloudflareworkers: '#f38020',
  vercel: '#000000',
  'vercel-icon': '#000000',
  netlify: '#00c7b7',
  supabase: '#3fcf8e',
  firebase: '#ffca28',
  prisma: '#2d3748',
  drizzle: '#c5f74f',

  // Languages / runtimes / tooling
  typescript: '#3178c6',
  'typescript-icon': '#3178c6',
  javascript: '#f7df1e',
  python: '#3776ab',
  rust: '#000000',
  go: '#00add8',
  java: '#007396',
  react: '#61dafb',
  vue: '#41b883',
  vuedotjs: '#41b883',
  'svelte-icon': '#ff3e00',
  svelte: '#ff3e00',
  angular: '#dd0031',
  'angular-icon': '#dd0031',
  nextjs: '#000000',
  'nextjs-icon': '#000000',
  nextdotjs: '#000000',
  nuxt: '#00dc82',
  nodejs: '#5fa04e',
  'nodejs-icon': '#5fa04e',
  nodedotjs: '#5fa04e',
  tailwindcss: '#06b6d4',
  'tailwindcss-icon': '#06b6d4',
  vite: '#646cff',
  vitejs: '#646cff',
  webpack: '#8dd6f9',
  eslint: '#4b32c3',
  prettier: '#f7b93e',
  npm: '#cb3837',
  pnpm: '#f69220',
  yarn: '#2c8ebb',
  bun: '#14151a',
  deno: '#000000',

  // OS
  apple: '#000000',
  microsoft: '#f25022',
  'microsoft-icon': '#f25022',
  windows: '#0078d4',
  android: '#3ddc84',
  'android-icon': '#3ddc84',
  ios: '#000000',
  linux: '#fcc624',
  'linux-tux': '#333333',
  ubuntu: '#e95420',
  debian: '#d70a53',
  archlinux: '#1793d1',
  fedora: '#51a2da',
  'raspberry-pi': '#a22846',
  raspberrypi: '#a22846',
}

/** SVG's named colours that actually appear in the bundled set. */const namedColors: Record<string, string> = {
  white: '#ffffff',
  black: '#000000',
  red: '#ff0000',
  lime: '#00ff00',
  blue: '#0000ff',
  yellow: '#ffff00',
  cyan: '#00ffff',
  aqua: '#00ffff',
  magenta: '#ff00ff',
  fuchsia: '#ff00ff',
  purple: '#800080',
  green: '#008000',
  navy: '#000080',
  teal: '#008080',
  olive: '#808000',
  maroon: '#800000',
  gray: '#808080',
  grey: '#808080',
  silver: '#c0c0c0',
}

type Rgb = [number, number, number]

function parseColor(value: string): Rgb | null {
  let normalized = value.trim().toLowerCase()
  if (namedColors[normalized]) normalized = namedColors[normalized]
  if (/^#[0-9a-f]{6}$/.test(normalized)) {
    return [
      parseInt(normalized.slice(1, 3), 16),
      parseInt(normalized.slice(3, 5), 16),
      parseInt(normalized.slice(5, 7), 16),
    ]
  }
  if (/^#[0-9a-f]{3}$/.test(normalized)) {
    return [
      parseInt(normalized[1] + normalized[1], 16),
      parseInt(normalized[2] + normalized[2], 16),
      parseInt(normalized[3] + normalized[3], 16),
    ]
  }
  return null
}

function toHex([r, g, b]: Rgb) {
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

/** WCAG relative luminance, 0 = black, 1 = white. */
function luminance([r, g, b]: Rgb) {
  const [rl, gl, bl] = [r, g, b].map((channel) => {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl
}

/**
 * Bundled icon bodies, keyed by `prefix:name`. Built once from the shipped
 * subset so the fallback never depends on a network request or the full
 * iconify collections (which would add megabytes for a colour swatch).
 */
const iconBodies = new Map<string, string>()
for (const collection of subset as unknown as Array<{
  prefix: string
  icons?: Record<string, { body?: unknown }>
}>) {
  for (const [name, data] of Object.entries(collection.icons ?? {})) {
    if (typeof data?.body === 'string') {
      iconBodies.set(`${collection.prefix}:${name}`, data.body)
    }
  }
}

/**
 * Most saturated prominent fill, used only when the brand is not in the table.
 * Highlights and knockouts (near-white, near-black) are skipped so a logo's
 * glow layers cannot win over its actual colour.
 */
function dominantColor(body: string): Rgb | null {
  const counts = new Map<string, { rgb: Rgb; count: number; order: number }>()
  let order = 0
  for (const match of body.matchAll(/(?:fill|stop-color)="([^"]+)"/g)) {
    const rgb = parseColor(match[1])
    if (!rgb) continue
    const key = toHex(rgb)
    const entry = counts.get(key)
    if (entry) entry.count += 1
    else counts.set(key, { rgb, count: 1, order: order++ })
  }

  const candidates = [...counts.values()]
    .map((entry) => ({ ...entry, lum: luminance(entry.rgb) }))
    .filter((entry) => entry.lum <= 0.82 && entry.lum >= 0.02)
  if (candidates.length === 0) return null

  // Weight by area proxy (occurrences) and by saturation, so a small vivid
  // brand mark beats a large neutral one.
  const saturation = (rgb: Rgb) => {
    const max = Math.max(...rgb) / 255
    const min = Math.min(...rgb) / 255
    return max === 0 ? 0 : (max - min) / max
  }
  candidates.sort(
    (a, b) =>
      b.count * (0.25 + saturation(b.rgb)) - a.count * (0.25 + saturation(a.rgb)) || a.order - b.order,
  )
  return candidates[0].rgb
}

const cache = new Map<string, string>()

/**
 * Brand colours keyed by registrable domain.
 *
 * Cards whose icon is a scraped favicon carry no icon id, so the brand has to
 * come from the address itself. Only widely recognised services are listed;
 * everything else falls back to the title hash, which keeps a single unlisted
 * site from being painted in some arbitrary colour.
 */
const siteColors: Record<string, string> = {
  'twitch.tv': '#9146ff',
  'youtube.com': '#ff0000',
  'youtu.be': '#ff0000',
  'github.com': '#181717',
  'gitlab.com': '#fc6d26',
  'gitee.com': '#c71d23',
  'google.com': '#4285f4',
  'bing.com': '#258ffa',
  'baidu.com': '#2932e1',
  'duckduckgo.com': '#de5833',
  'bilibili.com': '#00a1d6',
  'zhihu.com': '#0084ff',
  'douban.com': '#007722',
  'weibo.com': '#e6162d',
  'taobao.com': '#ff5000',
  'tmall.com': '#ff0036',
  'jd.com': '#e1251b',
  'alipay.com': '#1677ff',
  'qq.com': '#12b7f5',
  'weixin.qq.com': '#07c160',
  'netflix.com': '#e50914',
  'spotify.com': '#1db954',
  'soundcloud.com': '#ff5500',
  'steamcommunity.com': '#171a21',
  'store.steampowered.com': '#171a21',
  'reddit.com': '#ff4500',
  'twitter.com': '#1d9bf0',
  'x.com': '#000000',
  'facebook.com': '#0866ff',
  'instagram.com': '#e4405f',
  'discord.com': '#5865f2',
  'discord.gg': '#5865f2',
  'telegram.org': '#26a5e4',
  'notion.so': '#000000',
  'figma.com': '#f24e1e',
  'slack.com': '#4a154b',
  'openai.com': '#412991',
  'chatgpt.com': '#10a37f',
  'vercel.com': '#000000',
  'netlify.com': '#00c7b7',
  'cloudflare.com': '#f38020',
  'docker.com': '#2496ed',
  'hub.docker.com': '#2496ed',
  'npmjs.com': '#cb3837',
  'vercel.app': '#000000',
  'proxmox.com': '#e57000',
  'grafana.com': '#f46800',
  'jellyfin.org': '#00a4dc',
  'plex.tv': '#e5a00d',
  'emby.media': '#52b54b',
  'nextcloud.com': '#0082c9',
  'synology.com': '#b5b5b6',
  'openwrt.org': '#00b5e2',
  'portainer.io': '#13bef9',
  'home-assistant.io': '#18bcf2',
  'excalidraw.com': '#6965db',
  'obsidian.md': '#7c3aed',
  'wordpress.org': '#21759b',
  'stackoverflow.com': '#f48024',
  'npmjs.org': '#cb3837',
}

/** Icon id without the `iconify:` prefix, split into collection and name. */
function splitIconId(icon: string) {
  const id = icon.startsWith('iconify:') ? icon.slice('iconify:'.length) : icon
  const [collection, ...rest] = id.split(':')
  return { id, collection, name: rest.join(':') }
}

/**
 * Brand colour for an icon id, or `''` when the icon has no colour of its own
 * (images, emoji, monochrome glyphs with no known brand).
 */
export function brandColorForIcon(icon: string): string {
  const { id, name } = splitIconId(icon)
  if (!name || !/^[a-z0-9-]+$/i.test(name)) return ''

  const cached = cache.get(id)
  if (cached !== undefined) return cached

  const baseName = name.replace(/-icon$/, '')
  let result = brandColors[name] ?? brandColors[baseName] ?? ''

  if (!result) {
    // Prefer the `logos` rendering when the used collection is monochrome.
    const bodies = [
      iconBodies.get(id),
      iconBodies.get(`logos:${baseName}`),
      iconBodies.get(`logos:${baseName}-icon`),
    ].filter((body): body is string => Boolean(body))
    for (const body of bodies) {
      const rgb = dominantColor(body)
      if (rgb) {
        result = toHex(rgb)
        break
      }
    }
  }

  if (!result) return ''

  cache.set(id, result)
  return result
}

/**
 * Brand colour derived from a card's address, for cards whose icon is a scraped
 * favicon (which carries no icon id to look up).
 *
 * Favicon proxies hide the real site in a query parameter
 * (`api.xinac.net/icon?url=twitch.tv`), so both the host itself and any
 * embedded address are considered. The longest listed suffix wins so subdomains
 * resolve to their parent brand.
 */
export function brandColorForUrl(url: string): string {
  if (!url) return ''

  const cached = cache.get(`url:${url}`)
  if (cached !== undefined) return cached

  let result = ''
  for (const host of candidateHosts(url)) {
    const color = siteColorForHost(host)
    if (color) {
      result = color
      break
    }
  }

  cache.set(`url:${url}`, result)
  return result
}

function siteColorForHost(host: string): string {
  const parts = host.split('.')
  for (let i = 0; i < parts.length - 1; i += 1) {
    const candidate = parts.slice(i).join('.')
    const color = siteColors[candidate]
    if (color) return color
  }
  return ''
}

/** Hostnames worth matching: any embedded target first, then the host itself. */
function candidateHosts(raw: string): string[] {
  const hosts: string[] = []
  const add = (value: string) => {
    const host = hostnameOf(value)
    if (host && !hosts.includes(host)) hosts.push(host)
  }

  // `url` and `domain` are the parameters used by favicon providers; broader
  // names such as `q` show up in ordinary search links and would match the
  // wrong brand.
  for (const match of raw.matchAll(/[?&](?:url|domain)=([^&#]+)/gi)) {
    const value = match[1]
    let decoded = value
    try {
      decoded = decodeURIComponent(value)
    } catch {
      // Keep the raw value when it is not valid percent-encoding.
    }
    add(decoded)
  }
  add(raw)
  return hosts
}

function hostnameOf(url: string): string {
  if (!url) return ''
  try {
    const parsed = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`)
    return parsed.hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return ''
  }
}
