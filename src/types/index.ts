export type CardStyle = 'icon' | 'card' | 'solid' | 'transparent'
export type GroupStyle = CardStyle | 'inherit'
export type OpenMode = 'new' | 'self'
export type NetworkMode = 'auto' | 'internal' | 'external'
export type Appearance = 'dark' | 'light'
export type WallpaperCategory = 'icon' | 'wallpaper'

export interface NavItem {
  id: string
  groupId: string
  title: string
  description: string
  url: string
  lanUrl: string
  icon: string
  iconColor: string
  badge: string
  openMode: OpenMode
  hidden: boolean
  sort: number
  createdAt: number
}

export interface NavGroup {
  id: string
  name: string
  description: string
  style: GroupStyle
  sort: number
  hidden: boolean
  /** Whether the group's cards start collapsed on the navigation page. */
  collapsed: boolean
}

export interface SearchEngine {
  id: string
  name: string
  url: string
  icon: string
  iconColor: string
  sort: number
  builtin?: boolean
}

export interface GalleryAsset {
  id: string
  name: string
  category: WallpaperCategory
  /** Public URL in R2 / Vercel Blob / Docker file storage. Cloud storage is required in server mode. */
  dataUrl: string
  size: number
  createdAt: number
  /** Object key returned by the cloud asset API, used when deleting. */
  remoteKey?: string
}

export type Wallpaper =
  | { type: 'preset'; presetId: string }
  | { type: 'url'; url: string }
  | { type: 'gallery'; assetId: string }

export interface SiteConfig {
  siteName: string
  siteTitle: string
  logoImage: string
  /** Display name of the signed-in administrator. */
  adminName: string
  /** Avatar URL or `gallery:<assetId>` reference for the administrator. */
  adminAvatar: string
  showLogo: boolean
  showClock: boolean
  showSeconds: boolean
  showDate: boolean
  use24Hour: boolean
  publicAccess: boolean
  showSearch: boolean
  searchPlaceholder: string
  defaultEngineId: string
  searchInNewTab: boolean
  wallpaper: Wallpaper
  wallpaperBlur: number
  overlayOpacity: number
  appearance: Appearance
  defaultCardStyle: CardStyle
  cardRadius: number
  glowEffect: boolean
  showSystemStatus: boolean
  systemStatusTitle: string
  footerEnabled: boolean
  footerText: string
  footerHtml: string
  showNetworkSwitch: boolean
  networkMode: NetworkMode
  customCss: string
  customJs: string
  defaultOpenMode: OpenMode
}

export interface AppData {
  config: SiteConfig
  groups: NavGroup[]
  items: NavItem[]
  searchEngines: SearchEngine[]
  gallery: GalleryAsset[]
}

export interface Session {
  expiresAt: number
}

export interface BackupFile extends AppData {
  app: 'hares-panel'
  version: number
  exportedAt: string
}

export interface WallpaperPreset {
  id: string
  name: string
  dark: string
  light: string
  waves: [string, string, string]
  recommendedAppearance?: Appearance
}
