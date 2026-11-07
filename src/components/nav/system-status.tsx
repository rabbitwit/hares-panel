import { useEffect, useMemo, useState } from 'react'
import { Cpu, HardDrive, MemoryStick, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { formatBytes } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface NavigatorExtras extends Navigator {
  deviceMemory?: number
  connection?: {
    effectiveType?: string
    downlink?: number
    rtt?: number
    saveData?: boolean
    type?: string
  }
  getBattery?: () => Promise<{
    level: number
    charging: boolean
    addEventListener: (type: string, listener: () => void) => void
  }>
}

interface StatusData {
  cores: number
  memory: number | null
  storageUsage: number | null
  storageQuota: number | null
  online: boolean
  effectiveType: string
  downlink: number | null
  rtt: number | null
  saveData: boolean
  battery: { level: number; charging: boolean } | null
  jsHeap: { used: number; total: number } | null
}

function useDeviceStatus() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [data, setData] = useState<StatusData>(() => ({
    cores: navigator.hardwareConcurrency || 0,
    memory: (navigator as NavigatorExtras).deviceMemory ?? null,
    storageUsage: null,
    storageQuota: null,
    online: navigator.onLine,
    effectiveType: (navigator as NavigatorExtras).connection?.effectiveType ?? '',
    downlink: (navigator as NavigatorExtras).connection?.downlink ?? null,
    rtt: (navigator as NavigatorExtras).connection?.rtt ?? null,
    saveData: (navigator as NavigatorExtras).connection?.saveData ?? false,
    battery: null,
    jsHeap: null,
  }))

  useEffect(() => {
    let cancelled = false
    const nav = navigator as NavigatorExtras

    const update = async () => {
      const next: Partial<StatusData> = {
        cores: navigator.hardwareConcurrency || 0,
        memory: nav.deviceMemory ?? null,
        online: navigator.onLine,
        effectiveType: nav.connection?.effectiveType ?? '',
        downlink: nav.connection?.downlink ?? null,
        rtt: nav.connection?.rtt ?? null,
        saveData: nav.connection?.saveData ?? false,
      }

      if (navigator.storage?.estimate) {
        try {
          const estimate = await navigator.storage.estimate()
          next.storageUsage = estimate.usage ?? 0
          next.storageQuota = estimate.quota ?? 0
        } catch {
          // unsupported
        }
      }

      const performanceWithMemory = performance as Performance & {
        memory?: { usedJSHeapSize: number; totalJSHeapSize: number }
      }
      if (performanceWithMemory.memory) {
        next.jsHeap = {
          used: performanceWithMemory.memory.usedJSHeapSize,
          total: performanceWithMemory.memory.totalJSHeapSize,
        }
      }

      if (nav.getBattery) {
        try {
          const battery = await nav.getBattery()
          next.battery = { level: battery.level, charging: battery.charging }
        } catch {
          // unsupported
        }
      }

      if (!cancelled) {
        setData((previous) => ({ ...previous, ...next }))
      }
    }

    void update()
    const onOnline = () => void update()
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOnline)
    return () => {
      cancelled = true
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOnline)
    }
  }, [refreshKey])

  return { data, refresh: () => setRefreshKey((key) => key + 1) }
}

function storagePercent(usage: number | null, quota: number | null) {
  if (!usage || !quota) return 0
  return Math.min(100, Math.round((usage / quota) * 100))
}

export function SystemStatus() {
  const config = useAppStore((state) => state.config)
  const { data, refresh } = useDeviceStatus()
  const [open, setOpen] = useState(false)

  const percent = storagePercent(data.storageUsage, data.storageQuota)

  const networkText = useMemo(() => {
    if (!data.online) return '离线'
    if (data.effectiveType) return data.effectiveType.toUpperCase()
    return '在线'
  }, [data.effectiveType, data.online])

  if (!config.showSystemStatus) return null

  const cards = [
    {
      key: 'cpu',
      icon: Cpu,
      label: '处理器',
      value: data.cores ? `${data.cores} 核心` : '未知',
      hint: '浏览器可用线程',
    },
    {
      key: 'memory',
      icon: MemoryStick,
      label: '设备内存',
      value: data.memory ? `${data.memory} GB` : '未提供',
      hint: '浏览器上报近似值',
    },
    {
      key: 'storage',
      icon: HardDrive,
      label: '本地存储',
      value:
        data.storageUsage != null && data.storageQuota
          ? `${formatBytes(data.storageUsage)} / ${formatBytes(data.storageQuota)}`
          : '读取中',
      hint: data.storageQuota ? `已使用 ${percent}%` : '浏览器估算',
      progress: data.storageQuota ? percent : undefined,
    },
    {
      key: 'network',
      icon: data.online ? Wifi : WifiOff,
      label: '网络状态',
      value: networkText,
      hint: data.downlink ? `约 ${data.downlink} Mbps` : '浏览器网络信息',
    },
  ]

  const details = [
    ['处理器核心', data.cores ? `${data.cores} 核心` : '未知'],
    ['设备内存', data.memory ? `${data.memory} GB` : '浏览器未提供'],
    [
      '本地存储',
      data.storageQuota
        ? `${formatBytes(data.storageUsage ?? 0)} / ${formatBytes(data.storageQuota)} · ${percent}%`
        : '浏览器未提供',
    ],
    ['网络状态', data.online ? '在线' : '离线'],
    ['网络类型', data.effectiveType || '未知'],
    ['下行速度', data.downlink != null ? `${data.downlink} Mbps` : '未知'],
    ['网络延迟', data.rtt != null ? `${data.rtt} ms` : '未知'],
    ['省流量模式', data.saveData ? '已开启' : '关闭'],
    ['电池', data.battery ? `${Math.round(data.battery.level * 100)}%${data.battery.charging ? ' · 充电中' : ''}` : '浏览器未提供'],
    ['JS 堆内存', data.jsHeap ? `${formatBytes(data.jsHeap.used)} / ${formatBytes(data.jsHeap.total)}` : '浏览器未提供'],
    ['屏幕', `${window.screen.width} × ${window.screen.height} · ${window.devicePixelRatio}x`],
    ['语言', navigator.language],
    ['时区', Intl.DateTimeFormat().resolvedOptions().timeZone],
    ['页面运行时长', `${Math.floor(performance.now() / 1000 / 60)} 分钟`],
  ] as const

  return (
    <section className="mt-10 sm:mt-12" aria-labelledby="system-status-title">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h2
            id="system-status-title"
            className="text-shadow-nav text-[17px] font-semibold tracking-tight nav-ink sm:text-lg"
          >
            {config.systemStatusTitle}
          </h2>
          <Badge className="border-foreground/15 bg-foreground/8 text-[10px] font-normal text-foreground/55">
            本机
          </Badge>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={refresh}
          className="text-foreground/40 hover:bg-foreground/10 hover:text-foreground/80"
          aria-label="刷新设备状态"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => setOpen(true)}
              className="nav-item-surface group flex min-w-0 items-center gap-3 rounded-2xl px-3.5 py-3 text-left transition-all hover:-translate-y-0.5 hover:bg-foreground/12"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-foreground/10 bg-foreground/8 text-violet-600 dark:text-violet-200">
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-[11px] font-medium text-foreground/50">{card.label}</span>
                  <span className="hidden text-[10px] text-foreground/25 opacity-0 transition-opacity group-hover:opacity-100 sm:inline">
                    详情
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-[13px] font-semibold text-foreground/90">
                  {card.value}
                </span>
                {card.progress !== undefined ? (
                  <Progress value={card.progress} className="mt-1.5 h-1" />
                ) : (
                  <span className="mt-0.5 block truncate text-[10px] font-normal text-foreground/35">
                    {card.hint}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>设备详情</DialogTitle>
            <DialogDescription>
              以下数据来自当前浏览器可读取的本机信息，不会发送到任何服务器。
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[55vh] overflow-y-auto rounded-xl border border-border/70 bg-muted/30 p-1">
            {details.map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-4 border-b border-border/40 px-3 py-2.5 last:border-b-0"
              >
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className="max-w-[65%] break-all text-right text-xs font-medium">{value}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
