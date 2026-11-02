import type { CloudHealth } from '@/lib/cloud'
import { isTauri } from '@/lib/utils'

interface UADataLike {
  platform?: string
  mobile?: boolean
}

export interface ClientRuntimeInfo {
  /** 当前承载形态：Tauri 桌面端 / PWA / 浏览器 */
  shell: 'tauri' | 'pwa' | 'browser'
  shellLabel: string
  /** 实际渲染引擎，例如 Chrome 141 / Edge 141 / Safari 18 */
  browser: string
  os: string
  /** 用于卡片展示的短标签，例如 "Chrome 141 · Windows" */
  label: string
  host: string
  language: string
  screen: string
}

function navigatorUAData(): UADataLike | undefined {
  if (typeof navigator === 'undefined') return undefined
  return (navigator as Navigator & { userAgentData?: UADataLike }).userAgentData
}

function detectBrowser(ua: string): string {
  const checks: Array<[RegExp, string]> = [
    [/Edg(?:e|A|iOS)?\/([\d.]+)/, 'Edge'],
    [/OPR\/([\d.]+)/, 'Opera'],
    [/Firefox\/([\d.]+)/, 'Firefox'],
    [/Chrome\/([\d.]+)/, 'Chrome'],
    [/Version\/([\d.]+).*Safari/, 'Safari'],
  ]
  for (const [pattern, name] of checks) {
    const match = ua.match(pattern)
    if (match) return `${name} ${match[1].split('.')[0]}`
  }
  return '未知浏览器'
}

function detectOs(ua: string): string {
  const platform = navigatorUAData()?.platform
  const known: Record<string, string> = {
    Windows: 'Windows',
    macOS: 'macOS',
    Linux: 'Linux',
    Android: 'Android',
    'Chrome OS': 'ChromeOS',
    iOS: 'iOS',
  }
  if (platform && known[platform]) return known[platform]
  if (platform) return platform
  if (/Windows NT 10\.0/.test(ua)) return 'Windows 10/11'
  if (/Windows NT 6\.3/.test(ua)) return 'Windows 8.1'
  if (/Windows NT 6\.1/.test(ua)) return 'Windows 7'
  if (/Windows/.test(ua)) return 'Windows'
  if (/Android/.test(ua)) return 'Android'
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS'
  if (/Mac OS X/.test(ua)) return 'macOS'
  if (/CrOS/.test(ua)) return 'ChromeOS'
  if (/Linux/.test(ua)) return 'Linux'
  return '未知系统'
}

function isStandalone(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  if (window.matchMedia('(display-mode: minimal-ui)').matches) return true
  return (navigator as Navigator & { standalone?: boolean }).standalone === true
}

/** Reads the real environment the page is running in (no hard-coded labels). */
export function describeClientRuntime(): ClientRuntimeInfo {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const os = detectOs(ua)
  const browser = detectBrowser(ua)
  const tauri = isTauri()
  const standalone = !tauri && isStandalone()
  const shell: ClientRuntimeInfo['shell'] = tauri ? 'tauri' : standalone ? 'pwa' : 'browser'
  const shellLabel =
    shell === 'tauri' ? 'Tauri 桌面端' : shell === 'pwa' ? 'PWA 独立窗口' : '浏览器'
  const label =
    shell === 'browser' ? `${browser} · ${os}` : `${shellLabel} · ${os}`
  const screen =
    typeof window !== 'undefined'
      ? `${window.screen.width} × ${window.screen.height}${window.devicePixelRatio > 1 ? ` @${window.devicePixelRatio}x` : ''
      }`
      : '未知'

  return {
    shell,
    shellLabel,
    browser,
    os,
    label,
    host: typeof location !== 'undefined' ? location.host : '未知',
    language: typeof navigator !== 'undefined' ? navigator.language : '未知',
    screen,
  }
}

/** Builds the deployment label from the runtime reported by `/api/health`. */
export function describeDeployment(info: CloudHealth | null | undefined): string {
  if (!info) return '未连接服务端 API'
  switch (info.runtime) {
    case 'cloudflare-workers':
      return 'Cloudflare Workers'
    case 'vercel':
      return 'Vercel'
    case 'edgeone':
      return 'EdgeOne Makers'
    case 'docker':
      return 'Docker 自托管'
    case 'node':
      return 'Node 服务'
    case 'local':
      return '本地开发服务'
    default:
      return info.runtime || '未知服务端'
  }
}
