import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowDownUp,
  CheckCircle2,
  Download,
  Globe,
  HardDrive,
  KeyRound,
  Link2,
  Loader2,
  PlugZap,
  Server,
  ShieldCheck,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { PanelHeader, SettingsSection, SwitchRow } from './settings-ui'
import { useCloudStore } from '@/store/cloud-store'
import {
  cloudAssetLabel,
  cloudStorageLabel,
  syncCloudState,
  type CloudAssetKind,
  type CloudStorageKind,
  type CloudSyncMode,
  type CloudSyncResult,
} from '@/lib/cloud'
import { cn } from '@/lib/utils'

const SYNC_MODES: Array<{ value: CloudSyncMode; label: string; hint: string }> = [
  {
    value: 'auto',
    label: '自动判断',
    hint: '比较两端更新时间，把较新的一方复制到较旧的一方（双向同步）。',
  },
  {
    value: 'upload',
    label: '本机 → 远端',
    hint: '强制把本机数据覆盖到远端。',
  },
  {
    value: 'download',
    label: '远端 → 本机',
    hint: '强制用远端数据覆盖本机。适合内网实例手动拉取公网实例的更新（本机无需暴露到公网）。',
  },
]

function runtimeLabel(runtime: string | null | undefined): string {
  switch (runtime) {
    case 'cloudflare-workers':
      return 'Cloudflare Worker'
    case 'vercel':
      return 'Vercel'
    case 'edgeone':
      return 'EdgeOne'
    case 'docker':
      return 'Docker'
    default:
      return runtime ?? '未知'
  }
}

export function SyncSettingsPanel() {
  const status = useCloudStore((state) => state.status)
  const busy = useCloudStore((state) => state.busy)
  const error = useCloudStore((state) => state.error)
  const token = useCloudStore((state) => state.token)
  const reload = useCloudStore((state) => state.reload)
  const info = useCloudStore((state) => state.info)
  const syncMeta = useCloudStore((state) => state.syncMeta)
  const loadSyncMeta = useCloudStore((state) => state.loadSyncMeta)

  // Cloud deployments act as read-only sync targets; only self-hosted (Docker /
  // LAN) instances initiate sync and show the full address/password form.
  const isCloud = Boolean(
    info?.runtime && ['cloudflare-workers', 'vercel', 'edgeone'].includes(info.runtime),
  )

  const [remoteUrl, setRemoteUrl] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<CloudSyncMode>('auto')
  const [includeAssets, setIncludeAssets] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<CloudSyncResult | null>(null)

  const connected = status === 'connected'
  const sessionToken = token
  const running = syncing || testing

  const clearResult = () => {
    setResult(null)
    useCloudStore.getState().clearError()
  }

  // Cloud targets have no form; load their read-only sync status on open.
  useEffect(() => {
    if (isCloud && status === 'connected') {
      void loadSyncMeta()
    }
  }, [isCloud, status, loadSyncMeta])

  const runSync = async (action: 'test' | 'sync') => {
    if (!remoteUrl.trim()) {
      toast.error('请输入远端实例的地址')
      return
    }
    if (!password) {
      toast.error('请输入远端实例的管理员密码')
      return
    }
    if (!sessionToken) {
      toast.error('请先连接本机服务端并登录')
      return
    }

    if (action === 'test') setTesting(true)
    else setSyncing(true)
    clearResult()

    try {
      const payload = await syncCloudState(sessionToken, {
        remoteUrl,
        password,
        mode,
        includeAssets,
        action,
      })
      setResult(payload)

      if (action === 'sync') {
        if (payload.ok && payload.direction === 'download') {
          // The server already wrote the remote data locally. Re-fetch it so
          // the current page reflects the synced content.
          await reload()
        }
        if (payload.ok && payload.direction !== 'none') {
          toast.success('同步完成')
        } else if (payload.ok) {
          toast.info('两端内容一致，无需同步')
        }
      } else {
        toast.success('连接测试成功，远端实例可用')
      }
    } catch (syncError) {
      const message = syncError instanceof Error ? syncError.message : '同步失败'
      toast.error(message)
    } finally {
      setTesting(false)
      setSyncing(false)
    }
  }

  const directionLabel =
    result?.direction === 'upload'
      ? '本机 → 远端'
      : result?.direction === 'download'
        ? '远端 → 本机'
        : result?.direction === 'none'
          ? '无需同步'
          : '—'

  const assetSummary = result?.assets

  return (
    <div className="space-y-5">
      <PanelHeader
        title="实例同步"
        description="在本机实例与另一台实例（Cloudflare Worker / Vercel / EdgeOne / Docker）之间同步导航数据与图片。同步由本机发起：填另一台的地址与管理员密码即可，另一台无需反向访问本机。"
      />

      {!isCloud && (
        <SettingsSection
          title="同步目标"
          description="填写另一台实例的地址和它的 ADMIN_PASSWORD，测试确认可连接后再执行同步。填的地址是本机能访问到的地址（内网可填内网地址，远端在公网可填公网地址）。"
        >
          <div className="space-y-3">
            <div className="relative">
              <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={remoteUrl}
                onChange={(event) => setRemoteUrl(event.target.value)}
                placeholder="https://你的另一台实例.example.com"
                autoComplete="url"
                spellCheck={false}
                className="pl-9"
                disabled={running}
            />
          </div>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="远端实例的管理员密码（ADMIN_PASSWORD）"
              autoComplete="off"
              className="pl-9"
              disabled={running}
            />
          </div>
        </div>

        <div className="mt-4 space-y-1">
          <div className="text-[11px] font-medium text-muted-foreground">同步方向</div>
          {SYNC_MODES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setMode(option.value)}
              disabled={running}
              className={cn(
                'flex w-full items-start gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors',
                mode === option.value
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-border/60 hover:bg-accent/50',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                  mode === option.value
                    ? 'border-primary bg-primary'
                    : 'border-muted-foreground/40',
                )}
              >
                {mode === option.value && (
                  <span className="h-1.5 w-1.5 rounded-full bg-background" />
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-medium">{option.label}</span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
                  {option.hint}
                </span>
              </span>
            </button>
          ))}
        </div>

        <div className="mt-2 border-t border-border/60">
          <SwitchRow
            label="同步图片"
            hint="把另一台实例的图片对象一并复制；关闭时只同步导航文本，图片地址保持原样。"
            checked={includeAssets}
            onCheckedChange={setIncludeAssets}
            disabled={running}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => void runSync('test')}
            disabled={running || !connected}
          >
            {testing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <PlugZap className="mr-1.5 h-4 w-4" />}
            测试连接
          </Button>
          <Button type="button" onClick={() => void runSync('sync')} disabled={running || !connected}>
            {syncing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ArrowDownUp className="mr-1.5 h-4 w-4" />}
            执行同步
          </Button>
          {!connected && (
            <span className="text-[11px] text-muted-foreground">请先在「服务端与账号」中登录本机。</span>
          )}
        </div>
        </SettingsSection>
      )}

      {isCloud && (
        <SettingsSection
          title="同步状态"
          description="本实例部署在公网，作为同步目标只读展示最近一次与内网实例的同步结果。"
          actions={
            <button
              type="button"
              onClick={() => void loadSyncMeta()}
              className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
            >
              刷新
            </button>
          }
        >
          {syncMeta ? (
            <div className="space-y-2 text-[11px] leading-relaxed">
              <div className="flex items-center gap-2">
                {syncMeta.success ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                )}
                <span className="font-medium">
                  {syncMeta.success ? '已与内网实例同步' : '最近一次同步失败'}
                </span>
              </div>
              <div className="text-muted-foreground">
                上次同步：{new Date(syncMeta.lastSyncAt).toLocaleString('zh-CN')}
                {' · '}
                {syncMeta.direction === 'upload'
                  ? '本机 → 远端'
                  : syncMeta.direction === 'download'
                    ? '远端 → 本机'
                    : '无需同步'}
              </div>
              {syncMeta.error && (
                <div className="text-amber-600 dark:text-amber-300">{syncMeta.error}</div>
              )}
            </div>
          ) : (
            <div className="text-[11px] text-muted-foreground">
              尚未与内网实例同步过。请在内网实例的「实例同步」中填本实例地址并执行同步。
            </div>
          )}
        </SettingsSection>
      )}

      {result && (
        <SettingsSection
          title="同步结果"
          description={
            result.action === 'test'
              ? '仅检查了远端连通性，没有传输数据。'
              : '本次跨实例同步的结果摘要。'
          }
          actions={
            <button
              type="button"
              onClick={clearResult}
              className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
            >
              清除
            </button>
          }
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <Badge
                className={cn(
                  'gap-1',
                  result.direction === 'none'
                    ? 'bg-muted/20 text-muted-foreground'
                    : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
                )}
              >
                {result.ok && result.direction !== 'none' ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : result.direction === 'none' ? (
                  <Link2 className="h-3 w-3" />
                ) : (
                  <AlertTriangle className="h-3 w-3" />
                )}
                {directionLabel}
              </Badge>
              <Badge variant="outline" className="gap-1 font-normal">
                <Server className="h-3 w-3" />
                {runtimeLabel(result.remote.runtime)}
              </Badge>
              <Badge variant="outline" className="gap-1 font-normal">
                <HardDrive className="h-3 w-3" />
                数据 {cloudStorageLabel(result.remote.storage as CloudStorageKind | null)}
              </Badge>
              {result.remote.assets && (
                <Badge variant="outline" className="gap-1 font-normal">
                  <HardDrive className="h-3 w-3" />
                  图片 {cloudAssetLabel(result.remote.assets as CloudAssetKind | null)}
                </Badge>
              )}
            </div>

            {result.action === 'sync' && (
              <div className="grid gap-2 text-[11px] text-muted-foreground sm:grid-cols-2">
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
                  <span className="flex items-center gap-1.5">
                    <Upload className="h-3 w-3" />
                    本机更新
                  </span>
                  <span>
                    {result.localUpdatedAt
                      ? new Date(result.localUpdatedAt).toLocaleString('zh-CN')
                      : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
                  <span className="flex items-center gap-1.5">
                    <Download className="h-3 w-3" />
                    远端更新
                  </span>
                  <span>
                    {result.remoteUpdatedAt
                      ? new Date(result.remoteUpdatedAt).toLocaleString('zh-CN')
                      : '—'}
                  </span>
                </div>
              </div>
            )}

            {result.action === 'sync' && assetSummary && (
              <div className="rounded-lg border border-border/60 px-3 py-2 text-[11px] text-muted-foreground">
                <div className="flex items-center justify-between gap-3">
                  <span>图片传输</span>
                  <span>
                    共 {assetSummary.total} · 传输 {assetSummary.transferred} · 已存在{' '}
                    {assetSummary.existing}
                    {assetSummary.failed > 0 && (
                      <span className="text-amber-600 dark:text-amber-300">
                        {' '}
                        · 失败 {assetSummary.failed}
                      </span>
                    )}
                  </span>
                </div>
                {assetSummary.warnings.length > 0 && (
                  <div className="mt-2 space-y-1 border-t border-border/50 pt-2">
                    {assetSummary.warnings.map((warning, index) => (
                      <div key={index} className="flex items-start gap-1.5 text-amber-600 dark:text-amber-300">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                        {warning}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {result.warnings && result.warnings.length > 0 && (
              <div className="space-y-1">
                {result.warnings.map((warning, index) => (
                  <div key={index} className="flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-300">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    {warning}
                  </div>
                ))}
              </div>
            )}
          </div>
        </SettingsSection>
      )}

      {error && !result && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-2.5 text-[11px] leading-relaxed text-amber-700 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 flex-1">{error}</span>
        </div>
      )}

      <div className="space-y-2 rounded-2xl border border-border/70 bg-card/40 p-4 text-[11px] leading-relaxed text-muted-foreground">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          使用提示
        </div>
        <ul className="list-disc space-y-1 pl-4">
          <li>同步由本机发起：只需要本机能够访问远端地址，远端无需反向访问本机，本机也不必暴露到公网。例如内网实例可单向拉取公网实例的数据。</li>
          <li>「自动判断」按更新时间比较，把较新的一方覆盖较旧的一方；若两侧同时被编辑会出现冲突，请用「上传 / 下载」手动选择。</li>
          <li>图片对象在各平台独立存储，同步图片会真实传输图片文件；关闭「同步图片」则只同步地址。</li>
          <li>同步会用一端的数据覆盖另一端，操作前建议先在「备份与恢复」导出一份快照。</li>
        </ul>
      </div>
    </div>
  )
}