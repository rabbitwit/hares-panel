import type { AppData, NavGroup, NavItem, SearchEngine } from '@/types'

const now = Date.now()

function item(
  id: string,
  groupId: string,
  sort: number,
  title: string,
  description: string,
  url: string,
  icon: string,
  options: Partial<NavItem> = {},
): NavItem {
  return {
    id,
    groupId,
    title,
    description,
    url,
    lanUrl: '',
    icon,
    iconColor: '',
    badge: '',
    openMode: 'new',
    hidden: false,
    sort,
    createdAt: now,
    ...options,
  }
}

const groups: NavGroup[] = [
  {
    id: 'grp-common',
    name: '常用应用',
    description: '每天都会打开的那些',
    style: 'icon',
    sort: 0,
    hidden: false,
    collapsed: false,
  },
  {
    id: 'grp-nas',
    name: 'NAS 服务',
    description: '家庭数据中心',
    style: 'card',
    sort: 1,
    hidden: false,
    collapsed: false,
  },
  {
    id: 'grp-dev',
    name: '开发工具',
    description: '构建、部署与协作',
    style: 'transparent',
    sort: 2,
    hidden: false,
    collapsed: false,
  },
  {
    id: 'grp-media',
    name: '影音娱乐',
    description: '工作之外的放松时间',
    style: 'solid',
    sort: 3,
    hidden: false,
    collapsed: false,
  },
]

const items: NavItem[] = [
  // 常用应用
  item('item-google', 'grp-common', 0, 'Google', '搜索世界', 'https://www.google.com', 'logos:google-icon'),
  item('item-github', 'grp-common', 1, 'GitHub', '代码托管', 'https://github.com', 'simple-icons:github'),
  item('item-bilibili', 'grp-common', 2, '哔哩哔哩', '有趣的视频社区', 'https://www.bilibili.com', 'simple-icons:bilibili', {
    iconColor: '#00AEEC',
  }),
  item('item-youtube', 'grp-common', 3, 'YouTube', '全球视频平台', 'https://www.youtube.com', 'logos:youtube'),
  item('item-chatgpt', 'grp-common', 4, 'ChatGPT', 'AI 助手', 'https://chatgpt.com', 'simple-icons:openai', {
    iconColor: '#10A37F',
  }),
  item('item-baidu', 'grp-common', 5, '百度', '中文搜索', 'https://www.baidu.com', 'simple-icons:baidu', {
    iconColor: '#2932E1',
  }),

  // NAS 服务
  item(
    'item-homeassistant',
    'grp-nas',
    0,
    'Home Assistant',
    '智能家居控制中心',
    'https://www.home-assistant.io',
    'simple-icons:homeassistant',
    {
      iconColor: '#18BCF2',
      lanUrl: 'http://192.168.1.10:8123',
    },
  ),
  item('item-jellyfin', 'grp-nas', 1, 'Jellyfin', '开源媒体服务器', 'https://jellyfin.org', 'simple-icons:jellyfin', {
    iconColor: '#00A4DC',
    lanUrl: 'http://192.168.1.10:8096',
  }),
  item('item-nextcloud', 'grp-nas', 2, 'Nextcloud', '私有云盘与协作', 'https://nextcloud.com', 'simple-icons:nextcloud', {
    iconColor: '#0082C9',
    lanUrl: 'http://192.168.1.10:8080',
  }),
  item(
    'item-qbittorrent',
    'grp-nas',
    3,
    'qBittorrent',
    '下载任务管理',
    'https://www.qbittorrent.org',
    'simple-icons:qbittorrent',
    { iconColor: '#2F67B2', lanUrl: 'http://192.168.1.10:8081' },
  ),
  item('item-synology', 'grp-nas', 4, '群晖 DSM', 'NAS 管理后台', 'https://www.synology.com', 'simple-icons:synology', {
    lanUrl: 'http://192.168.1.10:5000',
  }),
  item('item-immich', 'grp-nas', 5, 'Immich', '自建照片图库', 'https://immich.app', 'simple-icons:immich', {
    iconColor: '#4250AF',
    lanUrl: 'http://192.168.1.10:2283',
  }),
  item('item-openwrt', 'grp-nas', 6, 'OpenWrt', '软路由控制台', 'https://openwrt.org', 'simple-icons:openwrt', {
    iconColor: '#00B5E2',
    lanUrl: 'http://192.168.1.1',
  }),
  item('item-portainer', 'grp-nas', 7, 'Portainer', '容器可视化管理', 'https://www.portainer.io', 'simple-icons:portainer', {
    iconColor: '#13BEF9',
    lanUrl: 'http://192.168.1.10:9000',
  }),

  // 开发工具
  item(
    'item-vscode',
    'grp-dev',
    0,
    'VS Code',
    '代码编辑器',
    'https://code.visualstudio.com',
    'logos:visual-studio-code',
  ),
  item('item-vercel', 'grp-dev', 1, 'Vercel', '前端部署平台', 'https://vercel.com', 'simple-icons:vercel'),
  item('item-cloudflare', 'grp-dev', 2, 'Cloudflare', '边缘网络与 Workers', 'https://dash.cloudflare.com', 'logos:cloudflare-icon'),
  item('item-docker', 'grp-dev', 3, 'Docker', '容器化应用', 'https://hub.docker.com', 'logos:docker-icon'),
  item('item-figma', 'grp-dev', 4, 'Figma', '界面设计协作', 'https://www.figma.com', 'logos:figma'),
  item('item-excalidraw', 'grp-dev', 5, 'Excalidraw', '手绘风格白板', 'https://excalidraw.com', 'simple-icons:excalidraw', {
    iconColor: '#6965DB',
  }),

  // 影音娱乐
  item('item-netflix', 'grp-media', 0, 'Netflix', '影视剧集', 'https://www.netflix.com', 'logos:netflix-icon', {
    iconColor: '#E50914',
  }),
  item('item-spotify', 'grp-media', 1, 'Spotify', '音乐与播客', 'https://open.spotify.com', 'logos:spotify-icon', {
    iconColor: '#1DB954',
  }),
  item('item-emby', 'grp-media', 2, 'Emby', '家庭影音中心', 'https://emby.media', 'simple-icons:emby', {
    iconColor: '#52B54B',
    lanUrl: 'http://192.168.1.10:8096',
  }),
  item('item-plex', 'grp-media', 3, 'Plex', '媒体库与串流', 'https://www.plex.tv', 'simple-icons:plex', {
    iconColor: '#EBAF00',
    lanUrl: 'http://192.168.1.10:32400',
  }),
  item('item-youtube-2', 'grp-media', 4, 'YouTube', '视频与直播', 'https://www.youtube.com', 'logos:youtube', {
    iconColor: '#FF0000',
  }),
  item('item-bilibili-2', 'grp-media', 5, '哔哩哔哩', '追番与创作', 'https://www.bilibili.com', 'simple-icons:bilibili', {
    iconColor: '#00AEEC',
  }),
]

const searchEngines: SearchEngine[] = [
  {
    id: 'engine-google',
    name: 'Google',
    url: 'https://www.google.com/search?q=%s',
    icon: 'logos:google-icon',
    iconColor: '',
    sort: 0,
    builtin: true,
  },
  {
    id: 'engine-bing',
    name: 'Bing',
    url: 'https://www.bing.com/search?q=%s',
    icon: 'logos:bing',
    iconColor: '',
    sort: 1,
    builtin: true,
  },
  {
    id: 'engine-baidu',
    name: '百度',
    url: 'https://www.baidu.com/s?wd=%s',
    icon: 'simple-icons:baidu',
    iconColor: '#2932E1',
    sort: 2,
    builtin: true,
  },
  {
    id: 'engine-ddgo',
    name: 'DuckDuckGo',
    url: 'https://duckduckgo.com/?q=%s',
    icon: 'logos:duckduckgo',
    iconColor: '',
    sort: 3,
    builtin: true,
  },
  {
    id: 'engine-github',
    name: 'GitHub',
    url: 'https://github.com/search?q=%s',
    icon: 'logos:github-icon',
    iconColor: '',
    sort: 4,
    builtin: true,
  },
]

export const demoData: AppData = {
  config: {
    siteName: 'Hares-Panel',
    siteTitle: 'Hares-Panel · 我的导航站',
    logoImage: '',
    adminName: '管理员',
    adminAvatar: '',
    showLogo: true,
    showLogoMark: true,
    showClock: true,
    showSeconds: true,
    showDate: true,
    use24Hour: true,
    publicAccess: true,
    showSearch: true,
    searchPlaceholder: '搜索网页，按 / 快速聚焦',
    defaultEngineId: 'engine-google',
    searchInNewTab: false,
    wallpaper: { type: 'preset', presetId: 'nebula' },
    bingWallpaperUrl: 'https://api.bimg.cc/today',
    wallpaperBlur: 0,
    overlayOpacity: 32,
    appearance: 'dark',
    defaultCardStyle: 'icon',
    cardRadius: 16,
    iconRadiusEnabled: true,
    iconRadius: 16,
    glowEffect: true,
    glassEffect: false,
    showSystemStatus: true,
    systemStatusTitle: '设备状态',
    footerEnabled: true,
    footerText: 'Hares-Panel · 保持好奇，保持连接',
    footerHtml: '',
    showNetworkSwitch: true,
    networkMode: 'auto',
    customCss: '',
    customJs: '',
    defaultOpenMode: 'new',
    syncRemoteUrl: '',
    syncPassword: '',
    syncMode: 'auto',
    syncIncludeAssets: true,
  },
  groups,
  items,
  searchEngines,
  gallery: [],
}
