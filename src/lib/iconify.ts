import { addCollection, iconLoaded, type IconifyJSON } from '@iconify/react'
import subset from '@/data/icon-subset.json'

let registered = false

/**
 * Iconify rejects a whole collection when one alias points at a missing
 * parent, and `addCollection` still returns `true` in that case. Dropping the
 * dangling aliases keeps the offline subset usable.
 */
function sanitizeCollection(collection: IconifyJSON): IconifyJSON {
  const icons = collection.icons ?? {}
  const aliases = collection.aliases ?? {}
  const validAliases = Object.fromEntries(
    Object.entries(aliases).filter(([, alias]) => {
      const parent = (alias as { parent?: string }).parent
      return Boolean(parent && (icons[parent] || aliases[parent]))
    }),
  )
  return {
    ...collection,
    icons,
    ...(Object.keys(validAliases).length ? { aliases: validAliases } : {}),
  }
}

export function registerBundledIcons() {
  if (registered) return
  registered = true
  const collections = subset as unknown as IconifyJSON[]
  for (const collection of collections) {
    addCollection(sanitizeCollection(collection))
  }
  const missing = collections
    .map((collection) => `${collection.prefix}:${Object.keys(collection.icons)[0]}`)
    .filter((name) => !iconLoaded(name))
  if (missing.length > 0) {
    console.warn('[hares-nav] bundled icons failed to register:', missing.join(', '))
  }
}

export interface PickerIcon {
  name: string
  collection: string
  label: string
}

const collectionLabels: Record<string, string> = {
  logos: '品牌 Logo',
  'simple-icons': 'Simple Icons',
  lucide: 'Lucide',
}

export function iconifyId(value: string) {
  return value.startsWith('iconify:') ? value.slice('iconify:'.length) : value
}

export function isIconifyName(value: string) {
  const id = iconifyId(value)
  return /^[a-z0-9-]+:[a-z0-9-]+$/i.test(id)
}

export function isImageSource(value: string) {
  return /^(https?:\/\/|\/|data:image\/|blob:|gallery:)/i.test(value)
}

export function isEmoji(value: string) {
  return Boolean(value) && [...value].length <= 4 && !isIconifyName(value) && !isImageSource(value)
}

export function iconNameToLabel(name: string) {
  return iconifyId(name)
    .split(':')
    .pop()
    ?.replaceAll('-', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase()) ?? name
}

/**
 * Icon ids whose artwork is drawn entirely in `currentColor`, so recolouring
 * them is lossless.
 *
 * Full-colour brand logos draw their own fills, and some of them (Netflix,
 * Spotify, Twitch …) paint an opaque background across the whole viewBox.
 * Flattening one of those to a single colour yields a solid block, which is
 * why they cannot be treated as silhouettes.
 */
const monochromeIds = new Set<string>()

for (const collection of subset as unknown as IconifyJSON[]) {
  for (const [name, definition] of Object.entries(collection.icons)) {
    const body = typeof definition === 'string' ? definition : definition.body
    // `url(#…)` points at a gradient in <defs>, which is still self-coloured.
    const hasOwnColour = /(?:fill|stroke|stop-color)="(?!none|currentColor|url\()/.test(body)
    if (!hasOwnColour) monochromeIds.add(`${collection.prefix}:${name}`)
  }
}

export function bundledIcons(): PickerIcon[] {
  const result: PickerIcon[] = []
  for (const collection of subset as unknown as IconifyJSON[]) {
    for (const name of Object.keys(collection.icons)) {
      result.push({
        name: `${collection.prefix}:${name}`,
        collection: collection.prefix,
        label: name.replaceAll('-', ' '),
      })
    }
  }
  return result.sort((a, b) => a.label.localeCompare(b.label))
}

const bundled = bundledIcons()

export function searchBundledIcons(query: string, limit = 120) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return bundled.slice(0, limit)
  const tokens = normalized.split(/\s+/)
  return bundled
    .map((icon) => {
      const haystack = `${icon.label} ${icon.collection} ${icon.name}`.toLowerCase()
      let score = 0
      for (const token of tokens) {
        if (!haystack.includes(token)) return { icon, score: -1 }
        if (icon.label.toLowerCase() === normalized) score += 8
        else if (icon.label.toLowerCase().startsWith(normalized)) score += 4
        else score += 1
      }
      return { icon, score }
    })
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.icon)
}

export async function searchRemoteIcons(query: string, limit = 120): Promise<PickerIcon[]> {
  const normalized = query.trim()
  if (normalized.length < 2) return []
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 4500)
  try {
    const response = await fetch(
      `https://api.iconify.design/search?query=${encodeURIComponent(normalized)}&limit=${limit}`,
      { signal: controller.signal },
    )
    if (!response.ok) throw new Error('Iconify search failed')
    const data = (await response.json()) as { icons?: string[] }
    return (data.icons ?? []).map((name) => ({
      name,
      collection: name.split(':')[0],
      label: name.split(':').slice(1).join(':').replaceAll('-', ' '),
    }))
  } catch {
    return []
  } finally {
    window.clearTimeout(timeout)
  }
}

export function collectionLabel(name: string) {
  return collectionLabels[name] ?? name
}

export function isMonochromeIcon(value: string) {
  return monochromeIds.has(iconifyId(value))
}
