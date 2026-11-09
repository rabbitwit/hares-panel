import { useNavigate } from 'react-router-dom'
import {
  CloudOff,
  Database,
  HardDrive,
  KeyRound,
  Loader2,
  RefreshCw,
  ServerCog,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { NavBackground } from '@/components/nav/background'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/app-store'
import { useCloudStore } from '@/store/cloud-store'
import { useSessionStore } from '@/store/session-store'
import { cloudAssetLabel, cloudStorageLabel } from '@/lib/cloud'

function GateShell({ children }: { children: React.ReactNode }) {
  const config = useAppStore((state) => state.config)
  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-4 py-16">
      <NavBackground />
      <div className="relative w-full max-w-[520px] overflow-hidden rounded-[28px] border border-white/12 bg-[#080d24]/78 p-7 text-white shadow-2xl shadow-black/40 backdrop-blur-2xl sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 bottom-0 h-40 w-40 rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <img
              src={`${import.meta.env.BASE_URL}logo-mark.svg`}
              alt=""
              className="h-11 w-11 rounded-xl"
            />
            <div className="min-w-0">
              <div className="font-display text-lg font-bold tracking-tight">{config.siteName}</div>
              <div className="text-[10px] text-white/40">服务端导航面板</div>
            </div>
          </div>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  )
}

export function BackendRequired() {
  const info = useCloudStore((state) => state.info)
  const error = useCloudStore((state) => state.error)
  const retry = useCloudStore((state) => state.retry)
  const storageName = cloudStorageLabel(info?.storage)
  const assetName = cloudAssetLabel(info?.assets)

  return (
    <GateShell>
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-400/25 bg-amber-400/10 text-amber-300">
          <CloudOff className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">服务端尚未就绪</h1>
          <p className="mt-1.5 text-[12px] leading-relaxed text-white/55">
            {error || '无法连接 /api。Hares-Panel 已改为服务端模式，请先部署并配置存储。'}
          </p>
        </div>
      </div>

      {info && (
        <div className="mt-5 flex flex-wrap items-center gap-2 text-[10px] text-white/45">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1">
            <Database className="h-3 w-3" />
            {storageName}
          </span>
          {assetName !== storageName && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1">
              <HardDrive className="h-3 w-3" />
              {assetName}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1">
            <KeyRound className="h-3 w-3" />
            {info.auth ? 'ADMIN_PASSWORD 已设置' : '缺少 ADMIN_PASSWORD'}
          </span>
        </div>
      )}

      <ol className="mt-6 space-y-2.5 rounded-2xl border border-white/10 bg-white/4 p-4 text-[11px] leading-relaxed text-white/55">
        <li className="flex gap-2">
          <span className="text-white/30">01</span>
          部署 Cloudflare Workers、Vercel、EdgeOne Makers，或使用 Docker 自托管，确保同源 <code className="text-white/75">/api/health</code> 可访问。
        </li>
        <li className="flex gap-2">
          <span className="text-white/30">02</span>
          配置 KV / D1（Vercel 为 Upstash Redis，EdgeOne 使用 Blob，Docker 使用本地文件）；图片可用 R2 或 KV、Vercel Blob、EdgeOne Blob 或本地目录。
        </li>
        <li className="flex gap-2">
          <span className="text-white/30">03</span>
          通过环境变量设置 <code className="text-white/75">ADMIN_PASSWORD</code>，然后刷新本页。
        </li>
      </ol>

      <div className="mt-5 space-y-2">
        <Button
          type="button"
          onClick={() => void retry()}
          className="h-10 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-[12px] text-white"
        >
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          重新检测
        </Button>
        <p className="text-[10px] text-white/30">本地模式已移除，数据只保存在服务端。</p>
      </div>
    </GateShell>
  )
}

export function SiteSetup() {
  const navigate = useNavigate()
  const session = useSessionStore((state) => state.session)
  const busy = useCloudStore((state) => state.busy)
  const push = useCloudStore((state) => state.push)
  const error = useCloudStore((state) => state.error)

  const initialize = async () => {
    const ok = await push()
    if (ok) toast.success('初始化完成，已写入内置示例数据')
    else toast.error(useCloudStore.getState().error || '初始化失败')
  }

  return (
    <GateShell>
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-violet-400/25 bg-violet-400/10 text-violet-300">
          <ServerCog className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">站点尚未初始化</h1>
          <p className="mt-1.5 text-[12px] leading-relaxed text-white/55">
            服务端存储已连接，但还没有导航数据。管理员登录后会把内置示例写入服务端，之后可以自由修改。
          </p>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[11px] leading-relaxed text-amber-200">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {session ? (
          <Button
            type="button"
            onClick={() => void initialize()}
            disabled={busy}
            className="h-10 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-[12px] text-white"
          >
            {busy ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            )}
            写入示例数据并开始
          </Button>
        ) : (
          <Button
            type="button"
            onClick={() => navigate('/login')}
            className="h-10 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-[12px] text-white"
          >
            使用管理员密码登录
          </Button>
        )}
        <span className="text-[10px] text-white/30">
          密码来自部署环境变量 ADMIN_PASSWORD
        </span>
      </div>
    </GateShell>
  )
}
