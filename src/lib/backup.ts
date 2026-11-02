import { z } from 'zod'
import { demoData } from '@/data/demo'
import type { AppData, BackupFile, NavGroup, NavItem } from '@/types'

const openModeSchema = z
  .enum(['new', 'self', 'window'])
  .transform((value): 'new' | 'self' => (value === 'window' ? 'new' : value))
const networkModeSchema = z.enum(['auto', 'internal', 'external'])
const appearanceSchema = z.enum(['dark', 'light'])
const cardStyleSchema = z.enum(['icon', 'card', 'solid', 'transparent'])

const wallpaperSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('preset'), presetId: z.string().min(1) }),
  z.object({ type: z.literal('url'), url: z.string() }),
  z.object({ type: z.literal('gallery'), assetId: z.string().min(1) }),
])

const configSchema = z
  .object({
    siteName: z.string().max(120),
    siteTitle: z.string().max(240),
    logoImage: z.string().max(2_500_000),
    adminName: z.string().max(40),
    adminAvatar: z.string().max(2_500_000),
    showLogo: z.boolean(),
    showClock: z.boolean(),
    showSeconds: z.boolean(),
    showDate: z.boolean(),
    use24Hour: z.boolean(),
    publicAccess: z.boolean(),
    showSearch: z.boolean(),
    searchPlaceholder: z.string().max(160),
    defaultEngineId: z.string(),
    searchInNewTab: z.boolean(),
    wallpaper: wallpaperSchema,
    wallpaperBlur: z.number().min(0).max(60),
    overlayOpacity: z.number().min(0).max(100),
    appearance: appearanceSchema,
    defaultCardStyle: cardStyleSchema,
    cardRadius: z.number().min(0).max(48),
    glowEffect: z.boolean(),
    showSystemStatus: z.boolean(),
    systemStatusTitle: z.string().max(80),
    footerEnabled: z.boolean(),
    footerText: z.string().max(500),
    footerHtml: z.string().max(20_000),
    showNetworkSwitch: z.boolean(),
    networkMode: networkModeSchema,
    customCss: z.string().max(200_000),
    customJs: z.string().max(200_000),
    defaultOpenMode: openModeSchema,
  })
  .partial()

const groupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80),
  description: z.string().max(400).default(''),
  style: z.enum(['icon', 'card', 'solid', 'transparent', 'inherit']).default('inherit'),
  sort: z.number().default(0),
  hidden: z.boolean().default(false),
  collapsed: z.boolean().default(false),
})

const itemSchema = z.object({
  id: z.string().min(1),
  groupId: z.string().min(1),
  title: z.string().min(1).max(120),
  description: z.string().max(500).default(''),
  url: z.string().default(''),
  lanUrl: z.string().default(''),
  icon: z.string().default(''),
  iconColor: z.string().default(''),
  badge: z.string().max(30).default(''),
  openMode: openModeSchema.default('new'),
  hidden: z.boolean().default(false),
  sort: z.number().default(0),
  createdAt: z.number().default(() => Date.now()),
})

const searchEngineSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80),
  url: z.string().min(1).max(2000),
  icon: z.string().default(''),
  iconColor: z.string().default(''),
  sort: z.number().default(0),
  builtin: z.boolean().optional(),
})

const galleryAssetSchema = z.object({
  id: z.string().min(1),
  name: z.string().max(240),
  category: z.enum(['icon', 'wallpaper']),
  dataUrl: z.string().min(1).max(30_000_000),
  size: z.number().min(0),
  createdAt: z.number().default(() => Date.now()),
  remoteKey: z.string().max(300).optional(),
})

const backupSchema = z.object({
  app: z.literal('hares-panel'),
  version: z.number().min(1).max(10),
  exportedAt: z.string().optional(),
  config: configSchema,
  groups: z.array(groupSchema).default([]),
  items: z.array(itemSchema).default([]),
  searchEngines: z.array(searchEngineSchema).default([]),
  gallery: z.array(galleryAssetSchema).default([]),
})

export type BackupSource = 'hares-panel' | 'flatnas' | 'sun-panel'

export interface BackupSummary {
  source: BackupSource
  groups: number
  items: number
  gallery: number
  engines: number
  exportedAt: string
}

export interface ParsedBackup {
  data: AppData
  summary: BackupSummary
  /** Non-fatal notes shown in the import dialog, e.g. dropped local icons. */
  warnings: string[]
}

export function serializeBackup(data: AppData): string {
  const backup: BackupFile = {
    app: 'hares-panel',
    version: 1,
    exportedAt: new Date().toISOString(),
    config: data.config,
    groups: data.groups,
    items: data.items,
    searchEngines: data.searchEngines,
    gallery: data.gallery,
  }
  return JSON.stringify(backup, null, 2)
}

export function backupFilename() {
  const stamp = new Date().toISOString().slice(0, 19).replaceAll(':', '-')
  return `hares-panel-backup-${stamp}.json`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    const text = asString(value)
    if (text) return text
  }
  return ''
}

function clip(value: string, length: number): string {
  return value.length > length ? value.slice(0, length) : value
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function hostnameFromUrl(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./i, '')
  } catch {
    return ''
  }
}

function flatNasDescription(item: Record<string, unknown>): string {
  const parts = [
    asString(item.description),
    asString(item.description1),
    asString(item.description2),
    asString(item.description3),
  ].filter(Boolean)
  return clip([...new Set(parts)].join(' · '), 500)
}

function cssColor(value: unknown): string {
  const text = asString(value)
  if (!text) return ''
  return /^(#[0-9a-f]{3,8}|rgba?\(|hsla?\(|var\()/i.test(text) ? clip(text, 40) : ''
}

interface FlatNasIconResult {
  icon: string
  dropped: boolean
}

/**
 * FlatNas backups reference uploaded icons with paths such as
 * `/icon-cache/<hash>.webp`; the backup never contains the image bytes, so
 * those references cannot work on another deployment. Absolute URLs, iconify
 * names, emoji and data URLs survive.
 */
function flatNasIcon(value: unknown): FlatNasIconResult {
  const icon = asString(value)
  if (!icon) return { icon: '', dropped: false }
  if (/^(https?:\/\/|\/\/|data:image\/)/i.test(icon)) {
    return { icon: icon.startsWith('//') ? `https:${icon}` : icon, dropped: false }
  }
  if (/^[a-z0-9-]+:[a-z0-9-]+$/i.test(icon) || /^iconify:/i.test(icon)) {
    return { icon, dropped: false }
  }
  if ([...icon].length <= 4 && !icon.startsWith('/')) {
    return { icon, dropped: false }
  }
  return { icon: '', dropped: true }
}

function looksLikeFlatNasBackup(value: Record<string, unknown>): boolean {
  const groups = Array.isArray(value.groups) ? value.groups : null
  const items = Array.isArray(value.items) ? value.items : null
  if (!groups && !items) return false
  const markerKeys = [
    'appConfig',
    'widgets',
    'rssFeeds',
    'rssCategories',
    'exclusiveLinks',
    'version',
  ]
  const hasMarker = markerKeys.some((key) => key in value)
  const groupLooksLikeFlatNas =
    groups?.some(
      (group) =>
        isRecord(group) &&
        (typeof group.title === 'string' || Array.isArray(group.items)),
    ) ?? false
  const itemsLookLikeFlatNas =
    items?.some(
      (item) =>
        isRecord(item) &&
        (typeof item.title === 'string' ||
          typeof item.url === 'string' ||
          typeof item.lanUrl === 'string'),
    ) ?? false
  return hasMarker || groupLooksLikeFlatNas || itemsLookLikeFlatNas
}

function parseHaresBackup(json: unknown): ParsedBackup {
  const parsed = backupSchema.safeParse(json)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    const path = first?.path.join('.') ?? ''
    throw new Error(
      path
        ? `备份文件字段「${path}」无效，请确认文件由 Hares-Panel 导出`
        : '备份文件格式不正确，请确认文件由 Hares-Panel 导出',
    )
  }

  const backup = parsed.data
  const groups = backup.groups
    .map((group, index) => ({ ...group, sort: Number.isFinite(group.sort) ? group.sort : index }))
    .sort((a, b) => a.sort - b.sort)
    .map((group, index) => ({ ...group, sort: index }))
  const groupIds = new Set(groups.map((group) => group.id))
  const items = backup.items
    .filter((item) => groupIds.has(item.groupId))
    .map((item) => ({ ...item }))
    .sort((a, b) => a.sort - b.sort)
  const gallery = backup.gallery
  const data: AppData = {
    config: { ...demoData.config, ...backup.config },
    groups,
    items,
    searchEngines: backup.searchEngines.length
      ? backup.searchEngines
        .sort((a, b) => a.sort - b.sort)
        .map((engine, index) => ({ ...engine, sort: index }))
      : demoData.searchEngines,
    gallery,
  }

  return {
    data,
    summary: {
      source: 'hares-panel',
      groups: groups.length,
      items: items.length,
      gallery: gallery.length,
      engines: data.searchEngines.length,
      exportedAt: backup.exportedAt ?? '',
    },
    warnings: [],
  }
}

interface FlatNasBuildState {
  groups: NavGroup[]
  items: NavItem[]
  sortByGroup: Map<string, number>
  groupIds: Map<string, string>
  /** Source keys already imported from `groups[].items`, used to skip the
   * duplicated flat `items` list that FlatNas always writes alongside groups. */
  seenSourceKeys: Set<string>
  droppedIcons: number
  itemSequence: number
}

function firstUrlFromList(value: unknown): string {
  if (!Array.isArray(value)) return ''
  for (const entry of value) {
    if (typeof entry === 'string') {
      const text = asString(entry)
      if (text) return text
    } else if (isRecord(entry)) {
      const text = firstString(entry.url, entry.href, entry.link)
      if (text) return text
    }
  }
  return ''
}

function flatNasSourceKeys(raw: Record<string, unknown>): string[] {
  const keys: string[] = []
  const id = firstString(raw.id)
  if (id) keys.push(`id:${id}`)
  const title = firstString(raw.title, raw.name)
  const url = firstString(raw.url, raw.href, raw.link)
  const lanUrl = firstString(raw.lanUrl, raw.lan, raw.intranetUrl)
  if (title || url || lanUrl) keys.push(`card:${title}|${url}|${lanUrl}`)
  return keys
}

function rememberFlatNasSource(state: FlatNasBuildState, raw: Record<string, unknown>): void {
  for (const key of flatNasSourceKeys(raw)) state.seenSourceKeys.add(key)
}

function isKnownFlatNasSource(state: FlatNasBuildState, raw: Record<string, unknown>): boolean {
  return flatNasSourceKeys(raw).some((key) => state.seenSourceKeys.has(key))
}

function addFlatNasGroup(
  state: FlatNasBuildState,
  title: string,
  options: { hidden?: boolean; collapsed?: boolean; sourceId?: string } = {},
): NavGroup {
  const group: NavGroup = {
    id: `flatnas-group-${state.groups.length + 1}`,
    name: clip(title || `分组 ${state.groups.length + 1}`, 80),
    description: '',
    style: 'inherit',
    sort: state.groups.length,
    hidden: options.hidden === true,
    collapsed: options.collapsed === true,
  }
  state.groups.push(group)
  if (options.sourceId) state.groupIds.set(options.sourceId, group.id)
  return group
}

function addFlatNasItem(
  state: FlatNasBuildState,
  raw: Record<string, unknown>,
  groupId: string,
): boolean {
  const url =
    firstString(raw.url, raw.href, raw.link) ||
    firstUrlFromList(raw.backupUrls) ||
    firstUrlFromList(raw.alternateUrls)
  const lanUrl =
    firstString(raw.lanUrl, raw.lan, raw.intranetUrl) || firstUrlFromList(raw.backupLanUrls)
  const title = clip(
    firstString(raw.title, raw.name) || hostnameFromUrl(url || lanUrl) || '未命名卡片',
    120,
  )
  const iconResult = flatNasIcon(firstString(raw.icon, raw.iconUrl, raw.logo))
  if (iconResult.dropped) state.droppedIcons += 1

  const sort = state.sortByGroup.get(groupId) ?? 0
  state.sortByGroup.set(groupId, sort + 1)
  state.itemSequence += 1
  rememberFlatNasSource(state, raw)

  const openMode =
    raw.openMode === 'self' ||
    raw.openInNewTab === false ||
    raw.target === '_self'
      ? 'self'
      : 'new'

  const createdAt = asNumber(raw.createdAt)
  state.items.push({
    id: `flatnas-item-${state.itemSequence}`,
    groupId,
    title,
    description: flatNasDescription(raw),
    url,
    lanUrl,
    icon: iconResult.icon,
    iconColor: cssColor(raw.iconColor ?? raw.color),
    badge: clip(firstString(raw.badge, raw.tag), 30),
    openMode,
    hidden: raw.hidden === true || raw.isPublic === false,
    sort,
    createdAt: createdAt ?? Date.now(),
  })
  return true
}

function appendBookmarkWidgets(
  state: FlatNasBuildState,
  widgets: unknown[],
): { converted: number; widgetsWithBookmarks: number } {
  let converted = 0
  let widgetsWithBookmarks = 0

  const addCategory = (raw: Record<string, unknown>, parentName: string): boolean => {
    const name = firstString(raw.title, raw.name) || '未命名分类'
    const groupName = parentName ? `${parentName} / ${name}` : name
    const group = addFlatNasGroup(state, groupName, { hidden: raw.isPublic === false })
    let filled = false
    const children = Array.isArray(raw.children) ? raw.children : []
    for (const child of children) {
      if (!isRecord(child)) continue
      if (Array.isArray(child.children)) {
        if (addCategory(child, groupName)) filled = true
      } else {
        addFlatNasItem(state, child, group.id)
        converted += 1
        filled = true
      }
    }
    if (!filled) {
      state.groups = state.groups.filter((entry) => entry.id !== group.id)
    }
    return filled
  }

  for (const widget of widgets) {
    if (!isRecord(widget) || !Array.isArray(widget.data)) continue
    if (widget.type !== 'bookmark' && widget.type !== 'bookmarks') continue
    const hasCategories = widget.data.some(
      (entry) => isRecord(entry) && Array.isArray(entry.children),
    )
    if (hasCategories) {
      widgetsWithBookmarks += 1
      for (const category of widget.data) {
        if (isRecord(category) && Array.isArray(category.children)) {
          addCategory(category, '')
        }
      }
    } else {
      const links = widget.data.filter(
        (entry) => isRecord(entry) && (entry.url || entry.href),
      )
      if (links.length === 0) continue
      widgetsWithBookmarks += 1
      const group = addFlatNasGroup(state, 'FlatNas 收藏')
      for (const link of links) {
        if (isRecord(link)) {
          addFlatNasItem(state, link, group.id)
          converted += 1
        }
      }
    }
  }

  return { converted, widgetsWithBookmarks }
}

function parseFlatNasBackup(json: Record<string, unknown>): ParsedBackup {
  const warnings: string[] = []
  const state: FlatNasBuildState = {
    groups: [],
    items: [],
    sortByGroup: new Map(),
    groupIds: new Map(),
    seenSourceKeys: new Set(),
    droppedIcons: 0,
    itemSequence: 0,
  }

  const rawGroups = Array.isArray(json.groups) ? json.groups : []
  const rawItems = Array.isArray(json.items) ? json.items : []
  let nestedItems = 0

  rawGroups.forEach((rawGroup, index) => {
    if (!isRecord(rawGroup)) return
    const groupItems = Array.isArray(rawGroup.items) ? rawGroup.items : []
    const rawTitle = firstString(rawGroup.title, rawGroup.name)
    if (!rawTitle && groupItems.length === 0) return
    const group = addFlatNasGroup(
      state,
      rawTitle || `分组 ${state.groups.length + 1}`,
      {
        hidden: rawGroup.isPublic === false || rawGroup.hidden === true,
        collapsed: rawGroup.collapsed === true,
        sourceId: firstString(rawGroup.id) || `group-${index + 1}`,
      },
    )
    for (const rawItem of groupItems) {
      if (!isRecord(rawItem)) continue
      if (addFlatNasItem(state, rawItem, group.id)) nestedItems += 1
    }
  })

  const addLooseItems = (list: Record<string, unknown>[], group: NavGroup) => {
    for (const raw of list) {
      if (isKnownFlatNasSource(state, raw)) continue
      addFlatNasItem(state, raw, group.id)
    }
  }

  // FlatNas always exports both `groups[].items` and a flattened top-level
  // `items` copy. Skip the copies, and keep any genuinely ungrouped cards.
  const looseItems = rawItems.filter(
    (raw): raw is Record<string, unknown> =>
      isRecord(raw) && !isKnownFlatNasSource(state, raw),
  )
  let looseImported = 0
  if (looseItems.length > 0) {
    const before = state.items.length
    const grouped = new Map<string, Record<string, unknown>[]>()
    const unmatched: Record<string, unknown>[] = []
    for (const raw of looseItems) {
      const sourceGroupId = firstString(raw.groupId, raw.group, raw.groupTitle)
      const target = sourceGroupId ? state.groupIds.get(sourceGroupId) : undefined
      if (target) {
        const list = grouped.get(target) ?? []
        list.push(raw)
        grouped.set(target, list)
      } else {
        unmatched.push(raw)
      }
    }
    for (const [groupId, list] of grouped) {
      const group = state.groups.find((entry) => entry.id === groupId)
      if (group) addLooseItems(list, group)
    }
    if (unmatched.length > 0) {
      const group = addFlatNasGroup(
        state,
        state.groups.length === 0 ? 'FlatNas 导入' : '未分组卡片',
      )
      addLooseItems(unmatched, group)
    }
    looseImported = state.items.length - before
  }

  let bookmarkWidgets = 0
  if (state.items.length === 0) {
    const widgets = Array.isArray(json.widgets) ? json.widgets : []
    const bookmarks = appendBookmarkWidgets(state, widgets)
    bookmarkWidgets = bookmarks.widgetsWithBookmarks
  }

  if (state.groups.length === 0 || state.items.length === 0) {
    throw new Error(
      '这个 FlatNas 备份中没有找到可导入的分组或卡片。请确认文件包含 groups / items 数据。',
    )
  }

  if (state.items.length > 0 && state.groups.length > 0) {
    state.groups.sort((a, b) => a.sort - b.sort)
  }

  if (nestedItems > 0 && looseImported > 0) {
    warnings.push(
      `已按 FlatNas 分组导入 ${nestedItems} 张卡片，并从顶层 items 补充了 ${looseImported} 张卡片。`,
    )
  }
  if (state.droppedIcons > 0) {
    warnings.push(
      `有 ${state.droppedIcons} 张卡片的图标是 FlatNas 本地路径（例如 /icon-cache/...），备份不包含图片本体，已留空；可在导入后重新选择图标。`,
    )
  }
  const widgetCount = Array.isArray(json.widgets) ? json.widgets.length : 0
  if (widgetCount > 0) {
    const ignored = widgetCount - bookmarkWidgets
    if (ignored > 0) {
      warnings.push(
        `FlatNas 的 ${ignored} 个小组件（时钟、天气、待办、RSS 等）不会导入；本次迁移分组与卡片数据。`,
      )
    }
  }

  const config = { ...demoData.config }
  const appConfig = isRecord(json.appConfig) ? json.appConfig : {}
  const customTitle = firstString(appConfig.customTitle, appConfig.siteName)
  if (customTitle) {
    config.siteName = clip(customTitle, 120)
    config.siteTitle = clip(`${customTitle} · 导航站`, 240)
  }
  const wallpaperConfig = isRecord(appConfig.wallpaperConfig)
    ? appConfig.wallpaperConfig
    : null
  const wallpaperUrl = firstString(wallpaperConfig?.url, appConfig.background)
  if (/^https?:\/\//i.test(wallpaperUrl)) {
    config.wallpaper = { type: 'url', url: wallpaperUrl }
  }

  const data: AppData = {
    config,
    groups: state.groups,
    items: state.items,
    searchEngines: demoData.searchEngines,
    gallery: [],
  }

  return {
    data,
    summary: {
      source: 'flatnas',
      groups: state.groups.length,
      items: state.items.length,
      gallery: 0,
      engines: data.searchEngines.length,
      exportedAt: firstString(json.exportedAt),
    },
    warnings,
  }
}

interface SunPanelIconResult {
  icon: string
  dropped: boolean
}

/**
 * Sun-Panel stores icons as `{ itemType, src, text, backgroundColor }`:
 * 1 = text / emoji avatar, 2 = image URL, 3 = Iconify name. Uploaded images
 * live only on the source Sun-Panel instance, so local paths cannot survive
 * the migration; absolute URLs and data URLs are kept.
 */
function sunPanelImageIcon(value: string): SunPanelIconResult {
  if (!value) return { icon: '', dropped: false }
  if (/^(https?:\/\/|\/\/|data:image\/)/i.test(value)) {
    return {
      icon: value.startsWith('//') ? `https:${value}` : value,
      dropped: false,
    }
  }
  return { icon: '', dropped: true }
}

function sunPanelTextIcon(value: string): string {
  const text = value.trim()
  if (!text) return ''
  if (/^[a-z0-9-]+:[a-z0-9-]+$/i.test(text) || /^iconify:/i.test(text)) return text
  // The navigation page renders short strings as emoji / text icons.
  return [...text].length <= 4 ? text : ''
}

function sunPanelIcon(value: unknown): SunPanelIconResult {
  if (typeof value === 'string') {
    const text = value.trim()
    if (!text) return { icon: '', dropped: false }
    if (/^(https?:\/\/|\/\/|data:image\/)/i.test(text)) return sunPanelImageIcon(text)
    if (/^[a-z0-9-]+:[a-z0-9-]+$/i.test(text) || /^iconify:/i.test(text)) {
      return { icon: text, dropped: false }
    }
    // A plain string icon with a path refers to a local upload.
    if (/[/\\]/.test(text)) return sunPanelImageIcon(text)
    return { icon: sunPanelTextIcon(text), dropped: false }
  }
  if (!isRecord(value)) return { icon: '', dropped: false }

  const itemType = asNumber(value.itemType)
  const src = asString(value.src)
  const text = asString(value.text)

  if (itemType === 2 || (itemType === null && src)) return sunPanelImageIcon(src)
  if (itemType === 3 || itemType === 1) {
    return { icon: sunPanelTextIcon(text), dropped: false }
  }
  if (text) return { icon: sunPanelTextIcon(text), dropped: false }
  if (src) return sunPanelImageIcon(src)
  return { icon: '', dropped: false }
}

function sunPanelGroupStyle(raw: Record<string, unknown>): NavGroup['style'] {
  const cardStyle = isRecord(raw.cardStyle) ? raw.cardStyle : null
  const rawStyle = cardStyle?.style ?? raw.style
  if (rawStyle === 'icon' || rawStyle === 1) return 'icon'
  if (rawStyle === 'card' || rawStyle === 0) return 'card'
  if (rawStyle === 'solid' || rawStyle === 'transparent' || rawStyle === 'inherit') {
    return rawStyle
  }
  return 'inherit'
}

function looksLikeSunPanelBackup(value: Record<string, unknown>): boolean {
  if (asString(value.appName).toLowerCase() === 'sun-panel-config') return true
  const icons = Array.isArray(value.icons) ? value.icons : null
  if (!icons) return false
  return icons.some(
    (group) =>
      isRecord(group) &&
      (Array.isArray(group.children) || Array.isArray(group.items)),
  )
}

function sunPanelExportTime(value: unknown): string {
  const text = asString(value)
  if (!text) return ''
  // Sun-Panel exports `YYYY-MM-DD HH:mm:ss`, which some browsers parse
  // inconsistently; make it ISO-like before the dialog renders it.
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text)
    ? text.replace(' ', 'T')
    : text
}

function sunPanelConfig(json: Record<string, unknown>): AppData['config'] {
  const config = { ...demoData.config }
  const styleConfig = [json.styleConfig, json.panelConfig, json.config].find(isRecord)
  if (!styleConfig) return config

  const siteName = firstString(styleConfig.logoText, styleConfig.siteName)
  if (siteName) {
    config.siteName = clip(siteName, 120)
    config.siteTitle = clip(`${siteName} · 导航站`, 240)
  }

  const logoImage = firstString(styleConfig.logoImageSrc, styleConfig.logoImage)
  if (/^(https?:\/\/|data:image\/)/i.test(logoImage)) {
    config.logoImage = logoImage
  }

  const background = firstString(styleConfig.backgroundImageSrc, styleConfig.background)
  if (/^(https?:\/\/|data:image\/)/i.test(background)) {
    config.wallpaper = { type: 'url', url: background }
  }

  const blur = asNumber(styleConfig.backgroundBlur)
  if (blur !== null) config.wallpaperBlur = Math.min(60, Math.max(0, blur))

  const mask = asNumber(styleConfig.backgroundMaskNumber)
  if (mask !== null) config.overlayOpacity = Math.round(Math.min(1, Math.max(0, mask)) * 100)

  const iconStyle = asNumber(styleConfig.iconStyle)
  if (iconStyle === 1) config.defaultCardStyle = 'icon'
  if (iconStyle === 0) config.defaultCardStyle = 'card'

  if (typeof styleConfig.clockShowSecond === 'boolean') {
    config.showSeconds = styleConfig.clockShowSecond
  }
  if (typeof styleConfig.searchBoxShow === 'boolean') {
    config.showSearch = styleConfig.searchBoxShow
  }
  if (typeof styleConfig.netModeChangeButtonShow === 'boolean') {
    config.showNetworkSwitch = styleConfig.netModeChangeButtonShow
  }
  if (typeof styleConfig.systemMonitorShow === 'boolean') {
    config.showSystemStatus = styleConfig.systemMonitorShow
  }

  return config
}

function parseSunPanelBackup(json: Record<string, unknown>): ParsedBackup {
  const warnings: string[] = []
  const rawGroups = Array.isArray(json.icons) ? json.icons : []
  const groupEntries = rawGroups
    .map((raw, index) => ({ raw, index }))
    .filter(
      (entry): entry is { raw: Record<string, unknown>; index: number } =>
        isRecord(entry.raw),
    )
    .sort((a, b) => {
      const sortA = asNumber(a.raw.sort) ?? a.index
      const sortB = asNumber(b.raw.sort) ?? b.index
      return sortA - sortB || a.index - b.index
    })

  const groups: NavGroup[] = []
  const items: NavItem[] = []
  let droppedIcons = 0
  let layerOpen = 0
  let skippedChildren = 0
  let itemSequence = 0

  for (const { raw } of groupEntries) {
    const children = Array.isArray(raw.children)
      ? raw.children
      : Array.isArray(raw.items)
        ? raw.items
        : []
    const group: NavGroup = {
      id: `sunpanel-group-${groups.length + 1}`,
      name: clip(
        firstString(raw.title, raw.name) || `分组 ${groups.length + 1}`,
        80,
      ),
      description: clip(asString(raw.description), 400),
      style: sunPanelGroupStyle(raw),
      sort: groups.length,
      hidden: raw.hidden === true || raw.isPublic === false,
      collapsed: raw.collapsed === true,
    }
    groups.push(group)

    const childEntries = children
      .map((child, index) => ({ raw: child, index }))
      .filter(
        (entry): entry is { raw: Record<string, unknown>; index: number } =>
          isRecord(entry.raw),
      )
      .sort((a, b) => {
        const sortA = asNumber(a.raw.sort) ?? a.index
        const sortB = asNumber(b.raw.sort) ?? b.index
        return sortA - sortB || a.index - b.index
      })
    skippedChildren += children.length - childEntries.length

    let sort = 0
    for (const { raw: child } of childEntries) {
      const url = firstString(child.url, child.href, child.link)
      const lanUrl = firstString(child.lanUrl, child.lan, child.intranetUrl)
      const iconResult = sunPanelIcon(child.icon)
      if (iconResult.dropped) droppedIcons += 1

      const openMethod = asNumber(child.openMethod)
      if (openMethod === 3) layerOpen += 1
      const openMode =
        child.openMode === 'self' ||
        child.openInNewTab === false ||
        openMethod === 1
          ? 'self'
          : 'new'

      const createdAt = asNumber(child.createdAt)
      itemSequence += 1
      items.push({
        id: `sunpanel-item-${itemSequence}`,
        groupId: group.id,
        title: clip(
          firstString(child.title, child.name) ||
            hostnameFromUrl(url || lanUrl) ||
            '未命名卡片',
          120,
        ),
        description: clip(asString(child.description), 500),
        url,
        lanUrl,
        icon: iconResult.icon,
        iconColor: cssColor(child.iconColor),
        badge: clip(firstString(child.badge, child.tag), 30),
        openMode,
        hidden: child.hidden === true || child.isPublic === false,
        sort,
        createdAt: createdAt ?? Date.now(),
      })
      sort += 1
    }
  }

  if (groups.length === 0 || items.length === 0) {
    throw new Error(
      '这个 Sun-Panel 配置中没有找到可导入的分组或卡片。请确认文件包含 icons 数据。',
    )
  }

  if (droppedIcons > 0) {
    warnings.push(
      `有 ${droppedIcons} 张卡片的图标是 Sun-Panel 本地上传图片（备份不包含图片本体），已留空；可在导入后重新选择图标或填写图片 URL。`,
    )
  }
  if (layerOpen > 0) {
    warnings.push(
      `有 ${layerOpen} 张卡片在 Sun-Panel 中使用站内浮层打开，本站不支持该方式，已转换为新标签页打开。`,
    )
  }
  if (skippedChildren > 0) {
    warnings.push(
      `有 ${skippedChildren} 个 Sun-Panel 卡片条目格式无法识别，已跳过。`,
    )
  }

  const data: AppData = {
    config: sunPanelConfig(json),
    groups,
    items,
    searchEngines: demoData.searchEngines,
    gallery: [],
  }

  return {
    data,
    summary: {
      source: 'sun-panel',
      groups: groups.length,
      items: items.length,
      gallery: 0,
      engines: data.searchEngines.length,
      exportedAt: sunPanelExportTime(json.exportTime),
    },
    warnings,
  }
}

export function parseBackupFile(text: string): ParsedBackup {
  if (text.length > 80 * 1024 * 1024) {
    throw new Error('备份文件超过 80 MB，无法导入')
  }

  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error('文件不是有效的 JSON')
  }

  if (!isRecord(json)) {
    throw new Error('备份文件格式不正确，请确认文件由 Hares-Panel、FlatNas 或 Sun-Panel 导出')
  }

  if (json.app === 'hares-panel') return parseHaresBackup(json)
  if (looksLikeSunPanelBackup(json)) return parseSunPanelBackup(json)
  if (looksLikeFlatNasBackup(json)) return parseFlatNasBackup(json)

  throw new Error(
    '无法识别的备份文件。请选择 Hares-Panel、FlatNas 或 Sun-Panel 导出的 JSON 文件。',
  )
}
