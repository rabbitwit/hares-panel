import { useEffect } from 'react'
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Cloud,
  Code2,
  Database,
  Download,
  ExternalLink,
  Github,
  Heart,
  Laptop,
  Loader2,
  RefreshCw,
  Rocket,
  ShieldAlert,
  Sparkles,
  TerminalSquare,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PanelHeader, SettingsSection } from './settings-ui'
import { useCloudStore } from '@/store/cloud-store'
import { useUpdateStore } from '@/store/update-store'
import { cloudAssetLabel, cloudStorageLabel } from '@/lib/cloud'
import { describeClientRuntime, describeDeployment } from '@/lib/runtime'
import { cn } from '@/lib/utils'
import { APP_VERSION_LABEL } from '@/lib/version'
import {
  UPDATE_DOCKER_HUB_URL,
  UPDATE_GUIDE_URL,
  UPDATE_REPOSITORY_URL,
  updateSourceLabel,
} from '@/lib/update'

const stack = [
  'React 18',
  'TypeScript',
  'Tailwind CSS',
  'Shadcn UI',
  'Vite',
  'Tauri 2',
  'Zustand',
  'Workers KV / D1',
  'R2 / Vercel Blob',
  'EdgeOne Blob',
  'Docker 自托管',
  'Node 文件存储',
]

const features = [
  '分组与卡片拖拽排序，支持跨分组移动',
  '图标、卡片、纯色、透明四种卡片样式',
  'Iconify 图标选择与 R2 / Blob / 本地图库',
  '内外网地址切换，自动识别访问环境',
  '环境变量管理员密码与 HMAC 签名登录',
  '完整备份导出、配置导入与示例数据恢复',
  '自动识别 FlatNas / Sun-Panel 备份并导入分组与卡片',
  '自定义 CSS / JavaScript 与页脚 HTML',
  '页内搜索、分组与卡片拖拽排序',
]

function formatCheckedAt(value: number) {
  if (!value) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))
}

export function AboutSettingsPanel() {
  const runtime = describeClientRuntime()
  const browser = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const cloudInfo = useCloudStore((state) => state.info)
  const updateStatus = useUpdateStore((state) => state.status)
  const updateInfo = useUpdateStore((state) => state.info)
  const updateError = useUpdateStore((state) => state.error)
  const checkUpdate = useUpdateStore((state) => state.check)
  const deployment = describeDeployment(cloudInfo)
  const storageName = cloudStorageLabel(cloudInfo?.storage)
  const assetName = cloudInfo?.assets ? cloudAssetLabel(cloudInfo.assets) : ''
  const storageLabel =
    assetName && assetName !== storageName ? `${storageName} + ${assetName}` : storageName

  const checking = updateStatus === 'checking'
  const updateAvailable = Boolean(updateInfo?.updateAvailable)
  const updateErrorText = (updateError || '检查更新失败').replace(/[。.!！]+$/, '')
  const updateTitle = checking
    ? '正在检查更新…'
    : updateStatus === 'error'
      ? '暂时无法检查更新'
      : updateStatus === 'idle'
        ? '尚未检查更新'
        : updateAvailable
          ? `发现新版本 v${updateInfo?.latestVersion}`
          : '当前已是最新版本'
  const updateDescription = checking
    ? '正在从 Docker Hub 和 GitHub 获取最新版本信息。'
    : updateStatus === 'error'
      ? `${updateErrorText}。请确认服务器可以访问 Docker Hub / GitHub，或稍后重试。`
      : updateStatus === 'idle'
        ? '打开此页时会自动检查（结果缓存约 12 小时），也可以点击右上角立即检查。'
        : updateAvailable
          ? `当前版本 ${APP_VERSION_LABEL}。升级镜像或应用不会影响导航数据和图片。`
          : `当前版本 ${APP_VERSION_LABEL} 已是已发布的最高版本。`
  const updateTone =
    checking || updateStatus === 'idle'
      ? 'border-sky-500/20 bg-sky-500/5'
      : updateStatus === 'error'
        ? 'border-amber-500/20 bg-amber-500/5'
        : updateAvailable
          ? 'border-sky-500/25 bg-sky-500/5'
          : 'border-emerald-500/20 bg-emerald-500/5'
  const updateIconTone =
    checking || updateStatus === 'idle'
      ? 'bg-sky-500/15 text-sky-500'
      : updateStatus === 'error'
        ? 'bg-amber-500/15 text-amber-500'
        : updateAvailable
          ? 'bg-sky-500/15 text-sky-500'
          : 'bg-emerald-500/15 text-emerald-500'

  useEffect(() => {
    void checkUpdate()
  }, [checkUpdate])

  return (
    <div className="space-y-5">
      <PanelHeader
        title="关于 Hares-Panel"
        description="一个服务端导航首页，部署在 Cloudflare Workers、Vercel、EdgeOne Makers 或 Docker，数据与图片保存在服务端存储。"
      />

      <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-violet-500/12 via-card/60 to-fuchsia-500/8 p-5 sm:p-6">
        <div className="absolute -right-10 -top-14 h-40 w-40 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="absolute -bottom-16 left-8 h-40 w-40 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-4">
          <img
            src={`${import.meta.env.BASE_URL}logo-mark.svg`}
            alt="Hares-Panel"
            className="h-16 w-16 rounded-[20px] drop-shadow-[0_8px_16px_rgba(79,70,229,.28)]"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-2xl font-bold tracking-tight">Hares-Panel</h3>
              <Badge variant="outline" className="text-[9px]">
                {APP_VERSION_LABEL}
              </Badge>
              {updateAvailable && (
                <a href={UPDATE_GUIDE_URL} target="_blank" rel="noreferrer">
                  <Badge className="gap-1 border-sky-500/20 bg-sky-500/15 text-[9px] text-sky-600 hover:bg-sky-500/20 dark:text-sky-300">
                    <Download className="h-2.5 w-2.5" />
                    有新版本 v{updateInfo?.latestVersion}
                  </Badge>
                </a>
              )}
              <Badge className="bg-emerald-500/15 text-[9px] text-emerald-600 hover:bg-emerald-500/15 dark:text-emerald-300">
                服务端模式
              </Badge>
            </div>
            <p className="mt-1.5 max-w-xl text-[11px] leading-relaxed text-muted-foreground">
              前端可部署到 Workers / Vercel / EdgeOne Makers，或使用 Docker 自托管；
              数据与图片由同源 API 和服务端存储提供。
            </p>
          </div>
        </div>
      </div>

      <SettingsSection
        title="版本更新"
        description="检查 Docker Hub 镜像和 GitHub 源码中是否发布了比当前更新的版本。成功结果缓存约 12 小时，手动检查会跳过缓存；检查只读取公开版本信息，不会上传站点数据。"
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={checking}
            onClick={() => void checkUpdate({ force: true })}
          >
            <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', checking && 'animate-spin')} />
            检查更新
          </Button>
        }
      >
        <div className={cn('flex items-start gap-3 rounded-xl border p-3.5', updateTone)}>
          <span
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
              updateIconTone,
            )}
          >
            {checking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : updateStatus === 'error' ? (
              <AlertCircle className="h-4 w-4" />
            ) : updateStatus === 'idle' ? (
              <RefreshCw className="h-4 w-4" />
            ) : updateAvailable ? (
              <Download className="h-4 w-4" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-semibold">{updateTitle}</span>
              {updateAvailable && (
                <Badge className="bg-sky-500/15 text-[9px] text-sky-600 hover:bg-sky-500/15 dark:text-sky-300">
                  v{updateInfo?.latestVersion}
                </Badge>
              )}
            </div>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              {updateDescription}
            </p>
            {updateInfo && (
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                <span>当前 {APP_VERSION_LABEL}</span>
                <span>最新 v{updateInfo.latestVersion}</span>
                <a
                  href={UPDATE_DOCKER_HUB_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all hover:text-foreground hover:underline"
                >
                  镜像 {updateInfo.image}
                  {updateInfo.latestTag ? `:${updateInfo.latestTag}` : ''}
                </a>
                <span>来源 {updateSourceLabel(updateInfo.source)}</span>
                <span>检查于 {formatCheckedAt(updateInfo.checkedAt)}</span>
              </div>
            )}
            {updateAvailable && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <a href={UPDATE_GUIDE_URL} target="_blank" rel="noreferrer">
                    查看升级方法
                    <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
                  </a>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <a href={UPDATE_REPOSITORY_URL} target="_blank" rel="noreferrer">
                    GitHub 仓库
                  </a>
                </Button>
              </div>
            )}
          </div>
        </div>
      </SettingsSection>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: Cloud, label: '部署方式', value: deployment },
          { icon: Database, label: '数据存储', value: storageLabel },
          { icon: Laptop, label: '当前运行环境', value: runtime.label },
        ].map((entry) => {
          const Icon = entry.icon
          return (
            <div key={entry.label} className="rounded-xl border border-border/70 bg-card/40 p-4">
              <Icon className="h-4 w-4 text-primary" />
              <div className="mt-3 text-[10px] text-muted-foreground">{entry.label}</div>
              <div className="mt-0.5 text-xs font-medium">{entry.value}</div>
            </div>
          )
        })}
      </div>

      <SettingsSection title="技术栈">
        <div className="flex flex-wrap gap-1.5">
          {stack.map((entry) => (
            <Badge key={entry} variant="secondary" className="font-normal">
              {entry}
            </Badge>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="功能一览">
        <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {features.map((feature) => (
            <div key={feature} className="flex items-start gap-2 text-[11px] leading-relaxed">
              <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-violet-400" />
              <span>{feature}</span>
            </div>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="部署与数据安全">
        <div className="space-y-3 text-[11px] leading-relaxed text-muted-foreground">
          <div className="flex gap-2.5">
            <Rocket className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
            <p>
              前端是可静态部署的 SPA；数据与图片由同源的 Workers、Vercel、EdgeOne 函数或 Docker Node 服务提供。使用 HashRouter，
              刷新任意页面都不需要额外的服务端回退规则。Tauri 桌面端需要后续接入可配置的服务端地址。
            </p>
          </div>
          <div className="flex gap-2.5">
            <Database className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            <p>
              导航数据保存在 {storageLabel}；公开访问只读取导航内容，管理凭据不会返回。
              不同设备访问同一部署时会读取同一份服务端数据，浏览器只保留登录令牌。
            </p>
          </div>
          <div className="flex gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p>
              管理员密码来自部署环境变量 ADMIN_PASSWORD（Docker 未设置时会自动生成并保存到数据目录），登录令牌由 HMAC 签名。
              公开接口不会返回管理凭据；请妥善保管环境变量和数据目录，并为部署平台账号启用双重验证。
            </p>
          </div>
          <div className="flex gap-2.5">
            <TerminalSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p>
              本项目不包含 Docker 容器管理功能：Workers / Vercel / EdgeOne 函数无法访问宿主机 Docker。
              Docker 自托管部署使用 Node 文件存储；设备状态卡片展示的是浏览器可读取的本机信息。
            </p>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="链接与致谢">
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <a href="https://github.com/rabbitwit/hares-panel" target="_blank" rel="noreferrer">
              <Github className="mr-1.5 h-3.5 w-3.5" />
              Hares-Panel 项目
              <ExternalLink className="ml-1 h-3 w-3 opacity-50" />
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href="https://icon-sets.iconify.design/" target="_blank" rel="noreferrer">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Iconify 图标
              <ExternalLink className="ml-1 h-3 w-3 opacity-50" />
            </a>
          </Button>
        </div>
        <div className="mt-4 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Heart className="h-3 w-3 text-rose-400" />
          用好奇心与代码搭建属于自己的小小入口。
        </div>
      </SettingsSection>

      <SettingsSection title="运行信息">
        <div className="space-y-1 rounded-xl border border-border/60 bg-muted/20 p-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
          <div>runtime: {runtime.label}</div>
          <div>shell: {runtime.shellLabel}</div>
          <div>engine: {runtime.browser}</div>
          <div>
            deploy: {deployment}
            {cloudInfo?.platform ? ` (${cloudInfo.platform})` : ''}
          </div>
          <div>
            storage: {cloudStorageLabel(cloudInfo?.storage)} / {cloudAssetLabel(cloudInfo?.assets)}
          </div>
          <div>language: {runtime.language}</div>
          <div>screen: {runtime.screen}</div>
          <div className="break-all">host: {runtime.host}</div>
          <div className="break-all">ua: {browser}</div>
        </div>
      </SettingsSection>
    </div>
  )
}
