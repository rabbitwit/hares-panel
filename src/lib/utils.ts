import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateId(prefix = 'id') {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function formatBytes(bytes: number, digits = 1) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / Math.pow(1024, index)
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : digits)} ${units[index]}`
}

export function formatTime(date: Date, options: { seconds?: boolean; use24Hour?: boolean }) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    ...(options.seconds ? { second: '2-digit' } : {}),
    hour12: options.use24Hour === false,
  }).format(date)
}

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

export function formatDateParts(date: Date) {
  return {
    day: `${date.getMonth() + 1}月${date.getDate()}日`,
    weekday: WEEKDAYS[date.getDay()],
  }
}

export function formatDate(date: Date) {
  const { day, weekday } = formatDateParts(date)
  return `${day} ${weekday}`
}

export function getDomain(url: string) {
  if (!url) return ''
  try {
    return new URL(normalizeUrl(url)).hostname.replace(/^www\./, '')
  } catch {
    return url.replace(/^https?:\/\//, '').split('/')[0]
  }
}

export function normalizeUrl(input: string) {
  const value = input.trim()
  if (!value) return ''
  if (/^(https?:|mailto:|tel:|ftp:|file:|magnet:|\/|#|data:|blob:)/i.test(value)) return value
  if (/^[\w-]+(\.[\w-]+)+([/?#].*)?$/.test(value) || /^localhost(:\d+)?(\/.*)?$/.test(value)) {
    return `https://${value}`
  }
  return value
}

export function isPrivateHostname(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (!host) return false
  if (host === 'localhost' || host === '::1' || host.endsWith('.local') || host.endsWith('.lan')) return true
  if (/^127\./.test(host)) return true
  if (/^10\./.test(host)) return true
  if (/^192\.168\./.test(host)) return true
  if (/^169\.254\./.test(host)) return true
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host)) return true
  return false
}

export function colorFromString(input: string) {
  let hash = 0
  for (let index = 0; index < input.length; index += 1) {
    hash = input.charCodeAt(index) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue} 70% 62%)`
}

export function colorWithAlpha(color: string, alpha: number) {
  if (!color) return `rgba(255,255,255,${alpha})`
  const normalized = color.trim()
  if (/^#[0-9a-f]{3}$/i.test(normalized)) {
    const r = parseInt(normalized[1] + normalized[1], 16)
    const g = parseInt(normalized[2] + normalized[2], 16)
    const b = parseInt(normalized[3] + normalized[3], 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  if (/^#[0-9a-f]{6}$/i.test(normalized)) {
    const r = parseInt(normalized.slice(1, 3), 16)
    const g = parseInt(normalized.slice(3, 5), 16)
    const b = parseInt(normalized.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  const hsl = normalized.match(/^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/)
  if (hsl) {
    return `hsl(${hsl[1]} ${hsl[2]}% ${hsl[3]}% / ${alpha})`
  }
  return normalized
}

function hslToRgb(hue: number, saturation: number, lightness: number) {
  const s = saturation / 100
  const l = lightness / 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const hp = (((hue % 360) + 360) % 360) / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  let rgb: [number, number, number] = [0, 0, 0]
  if (hp < 1) rgb = [c, x, 0]
  else if (hp < 2) rgb = [x, c, 0]
  else if (hp < 3) rgb = [0, c, x]
  else if (hp < 4) rgb = [0, x, c]
  else if (hp < 5) rgb = [x, 0, c]
  else rgb = [c, 0, x]
  const m = l - c / 2
  return rgb.map((channel) => Math.round((channel + m) * 255)) as [number, number, number]
}

/**
 * Rough sRGB luminance (0 = black, 1 = white) for a CSS hex / hsl color.
 * Used to pick readable text on top of a "solid" colored card.
 */
export function colorLuminance(color: string) {
  if (!color) return 0
  const normalized = color.trim()
  let rgb: [number, number, number] | null = null
  if (/^#[0-9a-f]{6}$/i.test(normalized)) {
    rgb = [
      parseInt(normalized.slice(1, 3), 16),
      parseInt(normalized.slice(3, 5), 16),
      parseInt(normalized.slice(5, 7), 16),
    ]
  } else if (/^#[0-9a-f]{3}$/i.test(normalized)) {
    rgb = [
      parseInt(normalized[1] + normalized[1], 16),
      parseInt(normalized[2] + normalized[2], 16),
      parseInt(normalized[3] + normalized[3], 16),
    ]
  } else {
    const hsl = normalized.match(/^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/)
    if (hsl) rgb = hslToRgb(Number(hsl[1]), Number(hsl[2]), Number(hsl[3]))
  }
  if (!rgb) return 0
  const [r, g, b] = rgb.map((channel) => {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function readableTextColor(color: string) {
  return colorLuminance(color) > 0.45 ? '#141726' : '#ffffff'
}

export function getInitials(title: string) {
  const clean = title.trim()
  if (!clean) return '?'
  const ascii = clean.match(/[A-Za-z0-9]/g)
  if (ascii && ascii.length > 0) {
    return clean
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()
  }
  return clean.slice(0, 1)
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  }
}

export function downloadFile(filename: string, content: string, type = 'application/json') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export async function downloadDataUrl(filename: string, dataUrl: string) {
  const save = (href: string) => {
    const link = document.createElement('a')
    link.href = href
    link.download = filename
    link.rel = 'noopener'
    link.click()
  }

  // Remote assets (R2 / Vercel Blob) may live on another origin where the
  // `download` attribute is ignored, so fetch them into a blob first.
  if (/^https?:\/\//i.test(dataUrl)) {
    try {
      const response = await fetch(dataUrl)
      if (!response.ok) throw new Error('download failed')
      const objectUrl = URL.createObjectURL(await response.blob())
      save(objectUrl)
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2000)
      return
    } catch {
      window.open(dataUrl, '_blank', 'noopener,noreferrer')
      return
    }
  }

  save(dataUrl)
}

export function isTauri() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

export function debounce<T extends (...args: never[]) => void>(fn: T, wait = 220) {
  let timer: number | undefined
  return (...args: Parameters<T>) => {
    window.clearTimeout(timer)
    timer = window.setTimeout(() => fn(...args), wait)
  }
}
