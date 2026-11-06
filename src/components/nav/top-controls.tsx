import { useNavigate } from 'react-router-dom'
import { Check, Cloud, Globe2, House, LayoutDashboard, LogOut, Palette, PencilLine, Settings2, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { UserAvatar } from '@/components/nav/user-avatar'
import { useAppStore } from '@/store/app-store'
import { useCloudStore } from '@/store/cloud-store'
import { useSessionStore } from '@/store/session-store'
import { useUiStore } from '@/store/ui-store'
import { resolveEffectiveNetwork } from '@/lib/network'
import { toast } from 'sonner'
import type { NetworkMode } from '@/types'

const networkOptions: Array<{ value: NetworkMode; label: string; hint: string }> = [
  { value: 'auto', label: '自动识别', hint: '根据当前访问地址自动选择' },
  { value: 'internal', label: '优先内网', hint: '优先打开内网地址' },
  { value: 'external', label: '优先外网', hint: '优先打开公网地址' },
]

export function TopControls() {
  const navigate = useNavigate()
  const config = useAppStore((state) => state.config)
  const updateConfig = useAppStore((state) => state.updateConfig)
  const session = useSessionStore((state) => state.session)
  const clearSession = useSessionStore((state) => state.clearSession)
  const editMode = useUiStore((state) => state.editMode)
  const toggleEditMode = useUiStore((state) => state.toggleEditMode)
  const openSettings = useUiStore((state) => state.openSettings)
  const openGallery = useUiStore((state) => state.openGallery)

  const network = resolveEffectiveNetwork(config.networkMode)
  const NetworkIcon = network === 'internal' ? House : Globe2
  const adminName = config.adminName.trim() || '管理员'

  return (
    <div className="fixed right-3 top-3 z-40 flex items-center gap-2 sm:right-5 sm:top-5">
      {config.showNetworkSwitch && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="nav-item-surface hidden h-10 items-center gap-2 rounded-full px-3.5 text-foreground/85 shadow-nav outline-none transition-colors hover:bg-foreground/15 focus-visible:ring-2 focus-visible:ring-foreground/30 sm:inline-flex"
              aria-label="切换网络环境"
            >
              <NetworkIcon className="h-4 w-4" />
              <span className="hidden text-xs font-medium sm:inline">
                {network === 'internal' ? '内网' : '外网'}
              </span>
              {config.networkMode === 'auto' && (
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" title="自动识别" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>网络环境</DropdownMenuLabel>
            {networkOptions.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => {
                  updateConfig({ networkMode: option.value })
                  toast.success(`网络模式：${option.label}`)
                }}
                className="items-start py-2.5"
              >
                <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                  {config.networkMode === option.value && <Check className="h-4 w-4 text-primary" />}
                </div>
                <div>
                  <div className="font-medium">{option.label}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{option.hint}</div>
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <div className="px-2.5 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
              当前页面被识别为{network === 'internal' ? '内网' : '外网'}环境。卡片右键菜单可直接选择内外网地址。
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {session ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="nav-item-surface inline-flex h-10 items-center gap-2 rounded-full p-1 text-foreground/85 shadow-nav outline-none transition-colors hover:bg-foreground/15 focus-visible:ring-2 focus-visible:ring-foreground/30 sm:pr-2.5"
              aria-label="账户菜单"
            >
              <UserAvatar
                name={adminName}
                avatar={config.adminAvatar}
                className="h-8 w-8"
                fallbackClassName="text-xs font-semibold"
              />
              <span className="hidden max-w-24 truncate text-xs font-medium sm:inline">{adminName}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="py-2">
              <div className="flex items-center gap-2.5">
                <UserAvatar
                  name={adminName}
                  avatar={config.adminAvatar}
                  className="h-8 w-8"
                  fallbackClassName="text-xs"
                />
                <div className="min-w-0">
                  <div className="truncate text-sm text-foreground">{adminName}</div>
                  <div className="truncate text-[11px] font-normal">
                    敏捷如兔，随心掌控
                  </div>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => openSettings('profile')}>
              <UserRound />
              个人资料
            </DropdownMenuItem>
            <DropdownMenuItem onClick={toggleEditMode}>
              <PencilLine />
              编辑模式
              {editMode && <Check className="ml-auto h-4 w-4 text-primary" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openSettings('site')}>
              <Settings2 />
              管理控制台
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openSettings('appearance')}>
              <Palette />
              个性化外观
            </DropdownMenuItem>
            <DropdownMenuItem onClick={openGallery}>
              <LayoutDashboard />
              图标与壁纸库
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => openSettings('cloud')}>
              <Cloud />
              服务端与账号
            </DropdownMenuItem>
            <DropdownMenuItem
              destructive
              onClick={() => {
                clearSession()
                useCloudStore.getState().disconnect()
                toast.success('已退出登录')
                if (!config.publicAccess) navigate('/login')
              }}
            >
              <LogOut />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button
          type="button"
          onClick={() => navigate('/login')}
          className="nav-item-surface h-10 gap-2 rounded-full bg-transparent px-4 text-foreground/85 shadow-nav hover:bg-foreground/15"
        >
          <UserRound className="h-4 w-4" />
          <span className="text-xs font-medium">登录</span>
        </Button>
      )}
    </div>
  )
}
