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
  /** Public URL in R2 / KV / Vercel Blob / Docker file storage. Cloud storage is required in server mode. */
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
  | { type: 'bing' }

export interface SiteConfig {
  siteName: string
  siteTitle: string
  logoImage: string
  /** Display name of the signed-in administrator. */
  adminName: string
  /** Avatar URL or `gallery:<assetId>` reference for the administrator. */
  adminAvatar: string
  showLogo: boolean
  /** Whether to show the logo image mark above the search on the nav page. */
  showLogoMark: boolean
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
  /** URL of the Bing daily-image API used when wallpaper type is `bing`. */
  bingWallpaperUrl: string
  wallpaperBlur: number
  overlayOpacity: number
  appearance: Appearance
  defaultCardStyle: CardStyle
  cardRadius: number
  /** Whether icon corner rounding is enabled. When off, icons render square. */
  iconRadiusEnabled: boolean
  /** Corner radius (px) of the icon artwork itself, not the surrounding card/tile. */
  iconRadius: number
  glowEffect: boolean
  /** Whether card backgrounds use a frosted-glass (backdrop blur) look. */
  glassEffect: boolean
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
  /** Remote instance URL remembered for cross-instance sync (initiator side). */
  syncRemoteUrl: string
  /** Remote instance admin password remembered for cross-instance sync. */
  syncPassword: string
  /** Remembered sync direction (initiator side). */
  syncMode: 'auto' | 'upload' | 'download'
  /** Remembered whether to include gallery assets when syncing. */
  syncIncludeAssets: boolean
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
