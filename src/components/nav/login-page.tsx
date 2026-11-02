import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Cloud,
  Eye,
  EyeOff,
  Globe2,
  KeyRound,
  Loader2,
  LockKeyhole,
  Server,
  ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NavBackground } from '@/components/nav/background'
import { useAppStore } from '@/store/app-store'
import { useCloudStore } from '@/store/cloud-store'
import { useSessionStore } from '@/store/session-store'
import { cloudAssetLabel, cloudStorageLabel } from '@/lib/cloud'
import { resolveAssetLike } from '@/lib/resolve-asset'
import { cn } from '@/lib/utils'

export function LoginPage() {
  const navigate = useNavigate()
  const config = useAppStore((state) => state.config)
  const gallery = useAppStore((state) => state.gallery)
  const session = useSessionStore((state) => state.session)
  const startSession = useSessionStore((state) => state.startSession)
  const status = useCloudStore((state) => state.status)
  const info = useCloudStore((state) => state.info)
  const busy = useCloudStore((state) => state.busy)
  const login = useCloudStore((state) => state.login)
  const tokenExpiry = useCloudStore((state) => state.expiresAt)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const connected = status === 'connected'
  const authReady = info?.auth !== false
  const isLight = config.appearance === 'light'
  const logo = resolveAssetLike(config.logoImage, gallery)
  const storageLabel = cloudStorageLabel(info?.storage)
  const assetLabel = info?.assets ? cloudAssetLabel(info.assets) : ''
  const adminName = config.adminName.trim() || '管理员'

  useEffect(() => {
    if (session && session.expiresAt > Date.now() && connected) {
      navigate('/', { replace: true })
    }
  }, [connected, navigate, session])

  const resume = () => {
    startSession(tokenExpiry ?? undefined)
    navigate('/', { replace: true })
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    if (!authReady) {
      setError('服务端尚未设置 ADMIN_PASSWORD，请先在部署平台配置环境变量')
      return
    }
    if (!password) {
      setError('请输入管理员密码')
      return
    }
    setSubmitting(true)
    try {
      const expiresAt = await login(password)
      startSession(expiresAt)
      toast.success(`欢迎回来，${adminName}`)
      navigate('/', { replace: true })
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : '登录失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden">
      <NavBackground />

      <div className="absolute left-4 top-4 z-10 sm:left-6 sm:top-6">
        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate('/')}
          className={cn(
            'nav-item-surface h-9 rounded-full px-3 text-xs',
            isLight
              ? 'text-slate-700 hover:bg-slate-900/8 hover:text-slate-900'
              : 'text-white/70 hover:bg-white/10 hover:text-white',
          )}
        >
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          返回导航
        </Button>
      </div>

      <div className="relative flex flex-1 items-center justify-center px-4 py-16 sm:py-20">
        <div
          className={cn(
            'w-full max-w-[410px] overflow-hidden rounded-[28px] border shadow-2xl backdrop-blur-2xl',
            isLight
              ? 'border-white/60 bg-white/72 text-slate-900 shadow-slate-900/20'
              : 'border-white/12 bg-[#080d24]/72 text-white shadow-black/40',
          )}
        >
          <div className="relative px-7 pb-7 pt-8 sm:px-8">
            <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-violet-500/20 blur-3xl" />
            <div className="pointer-events-none absolute -left-16 bottom-0 h-40 w-40 rounded-full bg-fuchsia-500/10 blur-3xl" />

            <div className="relative flex flex-col items-center text-center">
              <img
                src={logo || `${import.meta.env.BASE_URL}logo-mark.svg`}
                alt=""
                className="h-16 w-16 rounded-[20px] object-cover drop-shadow-[0_16px_30px_rgba(0,0,0,.35)]"
              />
              <h1
                className={cn(
                  'mt-4 font-display text-2xl font-bold tracking-[-0.035em]',
                  isLight ? 'text-slate-900' : 'text-white',
                )}
              >
                {config.siteName}
              </h1>
              {info?.storage && (
                <p
                  className={cn(
                    'mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px]',
                    isLight
                      ? 'border-slate-900/10 bg-white/50 text-slate-500'
                      : 'border-white/10 bg-white/5 text-white/40',
                  )}
                >
                  <Cloud className="h-2.5 w-2.5" />
                  {storageLabel}
                  {assetLabel && assetLabel !== storageLabel
                    ? ` · ${assetLabel}`
                    : assetLabel
                      ? ''
                      : ' · 未配置对象存储'}
                </p>
              )}
            </div>

            <form onSubmit={submit} className="relative mt-7 space-y-4">
              {!authReady && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2.5 text-[11px] leading-relaxed text-amber-200">
                  <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  服务端尚未设置 ADMIN_PASSWORD，请在部署平台添加环境变量后重新部署。
                </div>
              )}

              {connected && (
                <div
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-[11px]',
                    isLight
                      ? 'border-emerald-500/25 bg-emerald-500/8 text-emerald-700'
                      : 'border-emerald-400/20 bg-emerald-400/8 text-emerald-200',
                  )}
                >
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 leading-relaxed">
                    已保存登录凭据，可直接进入管理。
                  </span>
                  <button
                    type="button"
                    onClick={resume}
                    className="shrink-0 rounded-md px-2 py-1 text-[10px] font-medium underline-offset-2 hover:underline"
                  >
                    继续
                  </button>
                </div>
              )}

              <div className="space-y-2">
                <Label
                  htmlFor="login-password"
                  className={cn('text-[11px]', isLight ? 'text-slate-600' : 'text-white/55')}
                >
                  管理员密码
                </Label>
                <div className="relative">
                  <KeyRound
                    className={cn(
                      'pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2',
                      isLight ? 'text-slate-400' : 'text-white/30',
                    )}
                  />
                  <Input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value)
                      setError('')
                    }}
                    placeholder="请输入管理员密码"
                    autoComplete="current-password"
                    autoFocus
                    disabled={!authReady}
                    className={cn(
                      'h-11 rounded-xl pl-10 pr-10 text-sm',
                      isLight
                        ? 'border-slate-900/10 bg-white/65 text-slate-900 placeholder:text-slate-400'
                        : 'border-white/10 bg-white/6 text-white placeholder:text-white/25',
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className={cn(
                      'absolute right-3 top-1/2 -translate-y-1/2 transition-colors',
                      isLight ? 'text-slate-400 hover:text-slate-700' : 'text-white/35 hover:text-white/70',
                    )}
                    aria-label={showPassword ? '隐藏密码' : '显示密码'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-[11px] text-red-400">
                  <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={submitting || busy || !authReady}
                className="h-11 w-full rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-sm font-medium text-white shadow-lg shadow-violet-500/25 transition-transform hover:brightness-110"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    验证中…
                  </>
                ) : (
                  '进入管理'
                )}
              </Button>
            </form>

            <div
              className={cn(
                'relative mt-6 flex items-center justify-center gap-3 border-t pt-4 text-[9px]',
                isLight ? 'border-slate-900/10 text-slate-400' : 'border-white/8 text-white/30',
              )}
            >
              <span className="flex items-center gap-1">
                <Cloud className="h-3 w-3" />
                服务端存储
              </span>
              <span className="h-2.5 w-px bg-current opacity-20" />
              <span className="flex items-center gap-1">
                <Server className="h-3 w-3" />
                环境变量密码
              </span>
              <span className="h-2.5 w-px bg-current opacity-20" />
              <span className="flex items-center gap-1">
                <Globe2 className="h-3 w-3" />
                多设备访问
              </span>
            </div>
          </div>
        </div>
      </div>

      <div
        className={cn(
          'relative z-10 pb-5 text-center text-[10px]',
          isLight ? 'text-slate-500/70' : 'text-white/25',
        )}
      >
        {config.footerText || 'Hares-Panel · 服务端导航面板'}
      </div>
    </div>
  )
}
