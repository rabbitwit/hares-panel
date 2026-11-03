import { useEffect } from 'react'
import {
  Cloud,
  DatabaseBackup,
  Images,
  Info,
  LayoutGrid,
  Palette,
  Search,
  Settings2,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SiteSettingsPanel } from '@/components/nav/settings/site-settings'
import { ProfileSettingsPanel } from '@/components/nav/settings/profile-settings'
import { AppearanceSettingsPanel } from '@/components/nav/settings/appearance-settings'
import { SearchSettingsPanel } from '@/components/nav/settings/search-settings'
import { ContentSettingsPanel } from '@/components/nav/settings/content-settings'
import { MediaSettingsPanel } from '@/components/nav/settings/media-settings'
import { CloudSettingsPanel } from '@/components/nav/settings/cloud-settings'
import { BackupSettingsPanel } from '@/components/nav/settings/backup-settings'
import { AboutSettingsPanel } from '@/components/nav/settings/about-settings'
import { useAppStore } from '@/store/app-store'
import { useSessionStore } from '@/store/session-store'
import { useUiStore, type SettingsTab } from '@/store/ui-store'
import { UserAvatar } from '@/components/nav/user-avatar'
import { cn } from '@/lib/utils'
import { APP_VERSION_LABEL } from '@/lib/version'

const tabs: Array<{
  id: SettingsTab
  label: string
  icon: typeof Settings2
}> = [
    { id: 'site', label: '站点设置', icon: Settings2 },
    { id: 'profile', label: '个人资料', icon: UserRound },
    { id: 'appearance', label: '外观与布局', icon: Palette },
    { id: 'search', label: '搜索引擎', icon: Search },
    { id: 'content', label: '分组与内容', icon: LayoutGrid },
    { id: 'media', label: '图标与壁纸', icon: Images },
    { id: 'cloud', label: '服务端与账号', icon: Cloud },
    { id: 'backup', label: '备份与恢复', icon: DatabaseBackup },
    { id: 'about', label: '关于', icon: Info },
  ]

function SettingsPanel({ tab }: { tab: SettingsTab }) {
  switch (tab) {
    case 'site':
      return <SiteSettingsPanel />
    case 'profile':
      return <ProfileSettingsPanel />
    case 'appearance':
      return <AppearanceSettingsPanel />
    case 'search':
      return <SearchSettingsPanel />
    case 'content':
      return <ContentSettingsPanel />
    case 'media':
      return <MediaSettingsPanel />
    case 'cloud':
      return <CloudSettingsPanel />
    case 'backup':
      return <BackupSettingsPanel />
    case 'about':
      return <AboutSettingsPanel />
    default:
      return null
  }
}

export function SettingsDialog() {
  const open = useUiStore((state) => state.settingsOpen)
  const activeTab = useUiStore((state) => state.settingsTab)
  const setTab = useUiStore((state) => state.setSettingsTab)
  const close = useUiStore((state) => state.closeSettings)
  const config = useAppStore((state) => state.config)
  const session = useSessionStore((state) => state.session)
  const visibleTabs = tabs
  const adminName = config.adminName.trim() || '管理员'

  useEffect(() => {
    if (open && !session) close()
  }, [close, open, session])

  return (
    <Dialog open={open} onOpenChange={(value) => !value && close()}>
      <DialogContent
        hideClose
        className="h-[min(880px,92dvh)] max-w-6xl gap-0 overflow-hidden p-0"
      >
        <DialogTitle className="sr-only">管理控制台</DialogTitle>
        <DialogDescription className="sr-only">
          管理 Hares-Panel 的站点、外观、内容、账号与备份。
        </DialogDescription>

        <div className="flex h-full min-h-0 min-w-0">
          <aside className="hidden w-[220px] shrink-0 flex-col border-r border-border/70 bg-muted/25 md:flex">
            <div className="flex items-center gap-3 border-b border-border/60 px-4 py-4">
              <img
                src={`${import.meta.env.BASE_URL}logo-mark.svg`}
                alt=""
                className="h-9 w-9 rounded-xl"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold">{config.siteName}</div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">管理控制台</div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={close}
                aria-label="关闭设置"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <nav className="styled-scrollbar flex-1 space-y-0.5 overflow-y-auto p-2.5">
              {visibleTabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setTab(tab.id)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                      activeTab === tab.id &&
                      'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{tab.label}</span>
                  </button>
                )
              })}
            </nav>

            <div className="border-t border-border/60 p-3">
              <div className="flex items-center gap-2.5 rounded-lg bg-background/40 p-2">
                <UserAvatar
                  name={session ? adminName : ''}
                  avatar={session ? config.adminAvatar : ''}
                  className="h-8 w-8"
                  fallbackClassName="text-[11px] font-semibold"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] font-medium">
                    {session ? adminName : '未登录'}
                  </div>
                  <div className="truncate text-[9px] text-muted-foreground">管理员</div>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1 px-1 text-[9px] text-muted-foreground">
                <ShieldCheck className="h-2.5 w-2.5 text-emerald-500" />
                修改会自动保存到服务端
              </div>
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3 md:hidden">
              <img
                src={`${import.meta.env.BASE_URL}logo-mark.svg`}
                alt=""
                className="h-8 w-8 rounded-lg"
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold">管理控制台</div>
                <div className="truncate text-[10px] text-muted-foreground">{config.siteName}</div>
              </div>
              <Button type="button" variant="ghost" size="icon-sm" onClick={close} aria-label="关闭设置">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="border-b border-border/60 md:hidden">
              <div className="styled-scrollbar flex gap-1 overflow-x-auto px-2.5 py-2">
                {visibleTabs.map((tab) => {
                  const Icon = tab.icon
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setTab(tab.id)}
                      className={cn(
                        'flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground',
                        activeTab === tab.id && 'bg-primary/10 text-primary',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {tab.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="styled-scrollbar settings-scroll min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
              <SettingsPanel tab={activeTab} />
              <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-4 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3 w-3 text-emerald-500" />
                  公开访问读取服务端数据，账号信息不会公开
                </span>
                <Badge variant="outline" className="h-5 text-[9px] font-normal">
                  {APP_VERSION_LABEL}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
