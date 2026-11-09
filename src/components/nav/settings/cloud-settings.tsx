import { useState } from 'react'
import {
  AlertTriangle,
  Cloud,
  Database,
  HardDrive,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Unplug,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { PanelHeader, SettingsSection } from './settings-ui'
import { useCloudStore } from '@/store/cloud-store'
import { useSessionStore } from '@/store/session-store'
import { useUiStore } from '@/store/ui-store'
import { cloudAssetLabel, cloudStorageLabel } from '@/lib/cloud'
import { cn } from '@/lib/utils'

function BackendChip({ icon: Icon, children }: { icon: typeof Cloud; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-background/40 px-2 py-1 text-[10px] text-muted-foreground">
      <Icon className="h-3 w-3" />
      {children}
    </span>
  )
}

export function CloudSettingsPanel() {
  const status = useCloudStore((state) => state.status)
  const info = useCloudStore((state) => state.info)
  const token = useCloudStore((state) => state.token)
  const expiresAt = useCloudStore((state) => state.expiresAt)
  const lastSyncAt = useCloudStore((state) => state.lastSyncAt)
  const busy = useCloudStore((state) => state.busy)
  const error = useCloudStore((state) => state.error)
  const login = useCloudStore((state) => state.login)
  const push = useCloudStore((state) => state.push)
  const disconnect = useCloudStore((state) => state.disconnect)
  const clearError = useCloudStore((state) => state.clearError)
  const startSession = useSessionStore((state) => state.startSession)
  const clearSession = useSessionStore((state) => state.clearSession)
  const closeSettings = useUiStore((state) => state.closeSettings)

  const [password, setPassword] = useState('')
  const [connecting, setConnecting] = useState(false)

  const unavailable = status === 'unavailable'
  const connected = status === 'connected'
  const authReady = info?.auth !== false
  const storage = cloudStorageLabel(info?.storage)
  const assets = cloudAssetLabel(info?.assets ?? null)

  const connect = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!password) {
      toast.error('请输入管理员密码')
      return
    }
    setConnecting(true)
    try {
      const expiresAt = await login(password)
      startSession(expiresAt)
      setPassword('')
      toast.success('已连接服务端，修改会自动保存')
    } catch (connectError) {
      toast.error(connectError instanceof Error ? connectError.message : '连接服务端失败')
    } finally {
      setConnecting(false)
    }
  }

  const retrySave = async () => {
    const ok = await push()
    if (ok) toast.success('已保存到服务端')
    else toast.error(useCloudStore.getState().error || '保存失败')
  }

  return (
    <div className="space-y-5">
      <PanelHeader
        title="服务端与账号"
        description="部署在 Cloudflare Workers、Vercel、EdgeOne Makers 或 Docker 时使用的服务端配置。导航数据保存在 KV / D1、Upstash Redis、EdgeOne Blob 或 Docker 本地文件，图片保存在 R2 / KV / Vercel Blob / EdgeOne Blob 或 Docker 本地目录。"
      />

      <div
        className={cn(
          'flex items-start gap-3 rounded-2xl border p-4',
          connected
            ? 'border-emerald-500/25 bg-emerald-500/5'
            : unavailable
              ? 'border-border/70 bg-muted/20'
              : 'border-primary/25 bg-primary/5',
        )}
      >
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
            connected ? 'bg-emerald-500/15 text-emerald-500' : 'bg-primary/10 text-primary',
          )}
        >
          {connected ? <Cloud className="h-5 w-5" /> : <Database className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            {connected ? '服务端已连接' : unavailable ? '未检测到服务端 API' : '服务端已就绪'}
            {connected && (
              <Badge className="h-4 bg-emerald-500/15 px-1.5 text-[9px] font-normal text-emerald-600 dark:text-emerald-300">
                管理员
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            {connected
              ? info?.assets
                ? assets === storage
                  ? `数据与图片都保存在 ${storage}。`
                  : `数据保存在 ${storage}，图片保存在 ${assets}。`
                : `数据保存在 ${storage}，但尚未配置对象存储。`
              : unavailable
                ? '当前部署没有可用的 /api，请先完成服务端部署与绑定配置。'
                : info?.auth === false
                  ? '已检测到存储，但尚未设置 ADMIN_PASSWORD，暂时无法登录管理。'
                  : '检测到服务端后端。输入管理员密码后即可开始管理导航数据。'}
          </p>
          {!unavailable && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <BackendChip icon={Database}>{storage}</BackendChip>
              {info?.assets && assets !== storage && (
                <BackendChip icon={HardDrive}>{assets}</BackendChip>
              )}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-2.5 text-[11px] leading-relaxed text-amber-700 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 flex-1">{error}</span>
          {connected && (
            <button
              type="button"
              onClick={() => void retrySave()}
              disabled={busy}
              className="shrink-0 text-[10px] underline-offset-2 hover:underline disabled:opacity-50"
            >
              重试
            </button>
          )}
          <button
            type="button"
            onClick={clearError}
            className="shrink-0 text-[10px] underline-offset-2 hover:underline"
          >
            关闭
          </button>
        </div>
      )}

      {!connected && !unavailable && (
        <SettingsSection
          title="连接服务端"
          description="密码来自部署时设置的环境变量 ADMIN_PASSWORD。首次连接会把当前内容写入服务端，并立即对公开访问生效。"
        >
          <form onSubmit={connect} className="flex flex-col gap-3 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="请输入管理员密码"
                autoComplete="current-password"
                className="pl-9"
                disabled={connecting || !authReady}
              />
            </div>
            <Button type="submit" disabled={connecting || busy || !authReady} className="shrink-0">
              {connecting ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Cloud className="mr-1.5 h-4 w-4" />
              )}
              连接服务端
            </Button>
          </form>
          {!authReady && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[10px] leading-relaxed text-amber-700 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              请在部署平台设置环境变量 ADMIN_PASSWORD 并重新部署，然后刷新页面。
            </div>
          )}
        </SettingsSection>
      )}

      {connected && (
        <SettingsSection
          title="自动保存"
          description="修改导航内容后会在约 1.5 秒自动保存到服务端；刷新页面会重新加载服务端数据。"
        >
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                error
                  ? 'bg-amber-500/10 text-amber-500'
                  : 'bg-emerald-500/10 text-emerald-500',
              )}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : error ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
            </span>
            <div className="min-w-0">
              <div className="text-xs font-medium">
                {busy ? '正在保存…' : error ? '保存失败' : lastSyncAt ? '已保存' : '等待首次保存'}
              </div>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {lastSyncAt
                  ? `上次保存：${new Date(lastSyncAt).toLocaleString('zh-CN')}`
                  : '修改后会自动保存到服务端'}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3 text-[10px] text-muted-foreground">
            <span>无需手动上传；断开连接后修改只保留在当前页面。</span>
            <button
              type="button"
              onClick={() => {
                disconnect()
                clearSession()
                closeSettings()
                toast.success('已断开服务端连接，修改将不再自动保存')
              }}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 transition-colors hover:bg-red-500/10 hover:text-red-400"
            >
              <Unplug className="h-3 w-3" />
              断开连接
            </button>
          </div>

          <div className="mt-3 space-y-2 border-t border-border/60 pt-3 text-[10px] leading-relaxed text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-3 w-3 text-emerald-500" />
              公开访问只返回导航内容，不会暴露管理凭据。
            </div>
            <div className="flex items-center gap-1.5">
              <KeyRound className="h-3 w-3" />
              管理员登录使用环境变量密码；服务端不保存本地账号。
            </div>
            {expiresAt && (
              <div className="flex items-center gap-1.5">
                <RefreshCw className="h-3 w-3" />
                当前登录有效期至 {new Date(expiresAt).toLocaleString('zh-CN')}（使用中自动续期）
              </div>
            )}
          </div>
        </SettingsSection>
      )}

      {token && !connected && !unavailable && (
        <p className="text-[11px] text-muted-foreground">
          已保存服务端登录凭据，但尚未连接成功。请重新输入密码或检查后端配置。
        </p>
      )}
    </div>
  )
}
