import {
  Cloud,
  Code2,
  Database,
  ExternalLink,
  Github,
  Heart,
  Laptop,
  Rocket,
  ShieldAlert,
  Sparkles,
  TerminalSquare,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PanelHeader, SettingsSection } from './settings-ui'
import { useCloudStore } from '@/store/cloud-store'
import { cloudAssetLabel, cloudStorageLabel } from '@/lib/cloud'
import { describeClientRuntime, describeDeployment } from '@/lib/runtime'

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

export function AboutSettingsPanel() {
  const runtime = describeClientRuntime()
  const browser = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const cloudInfo = useCloudStore((state) => state.info)
  const deployment = describeDeployment(cloudInfo)
  const storageName = cloudStorageLabel(cloudInfo?.storage)
  const assetName = cloudInfo?.assets ? cloudAssetLabel(cloudInfo.assets) : ''
  const storageLabel =
    assetName && assetName !== storageName ? `${storageName} + ${assetName}` : storageName

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
            className="h-16 w-16 rounded-[20px] drop-shadow-xl"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-2xl font-bold tracking-tight">Hares-Panel</h3>
              <Badge variant="outline" className="text-[9px]">
                v0.1.0
              </Badge>
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
