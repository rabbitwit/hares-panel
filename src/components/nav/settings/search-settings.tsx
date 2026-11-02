import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Star,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { NavIcon } from '@/components/nav/nav-icon'
import { IconPicker } from '@/components/nav/icon-picker'
import { PanelHeader, SettingsSection, SwitchRow } from './settings-ui'
import { useAppStore } from '@/store/app-store'
import { cn } from '@/lib/utils'
import type { SearchEngine } from '@/types'

function SearchEngineDialog({
  open,
  engineId,
  onOpenChange,
}: {
  open: boolean
  engineId: string | null
  onOpenChange: (open: boolean) => void
}) {
  const engines = useAppStore((state) => state.searchEngines)
  const addSearchEngine = useAppStore((state) => state.addSearchEngine)
  const updateSearchEngine = useAppStore((state) => state.updateSearchEngine)
  const updateConfig = useAppStore((state) => state.updateConfig)

  const editing = engines.find((engine) => engine.id === engineId)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [icon, setIcon] = useState('')
  const [iconColor, setIconColor] = useState('')
  const [iconPickerOpen, setIconPickerOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(editing?.name ?? '')
    setUrl(editing?.url ?? '')
    setIcon(editing?.icon ?? '')
    setIconColor(editing?.iconColor ?? '')
    setIconPickerOpen(false)
  }, [editing, open])

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) {
      toast.error('请填写搜索引擎名称')
      return
    }
    if (!url.trim()) {
      toast.error('请填写搜索地址')
      return
    }
    if (!url.includes('%s')) {
      toast.error('搜索地址需要包含 %s，用于替换搜索关键词')
      return
    }
    const payload = {
      name: name.trim(),
      url: url.trim(),
      icon,
      iconColor,
    }
    if (editing) {
      updateSearchEngine(editing.id, payload)
      toast.success('搜索引擎已更新')
      onOpenChange(false)
      return
    }
    const id = addSearchEngine({ ...payload, builtin: false })
    updateConfig({ defaultEngineId: id })
    toast.success('搜索引擎已添加并设为默认')
    onOpenChange(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="z-[90] max-w-md">
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? '编辑搜索引擎' : '添加搜索引擎'}</DialogTitle>
              <DialogDescription>
                使用 %s 作为搜索关键词占位符，例如 https://www.google.com/search?q=%s。
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/25 p-3">
              <button
                type="button"
                onClick={() => setIconPickerOpen(true)}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background/60 transition-colors hover:border-primary/40"
                title="选择图标"
              >
                <NavIcon icon={icon} iconColor={iconColor} title={name || '搜索'} size={25} />
              </button>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium">搜索引擎图标</div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">点击左侧图标进行选择</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setIconPickerOpen(true)}>
                选择
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="engine-name">名称</Label>
              <Input
                id="engine-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="例如：Google"
                autoFocus
                maxLength={40}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="engine-url">搜索地址</Label>
              <Input
                id="engine-url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://www.google.com/search?q=%s"
                className="font-mono text-xs"
              />
              {editing?.builtin && (
                <p className="text-[10px] text-muted-foreground">这是内置搜索引擎，可以修改或删除。</p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button type="submit">{editing ? '保存修改' : '添加搜索引擎'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <IconPicker
        open={iconPickerOpen}
        onOpenChange={setIconPickerOpen}
        value={icon}
        color={iconColor}
        title={name || '搜索'}
        onSelect={(nextIcon, nextColor) => {
          setIcon(nextIcon)
          setIconColor(nextColor)
        }}
      />
    </>
  )
}

export function SearchSettingsPanel() {
  const config = useAppStore((state) => state.config)
  const engines = useAppStore((state) => state.searchEngines)
  const updateConfig = useAppStore((state) => state.updateConfig)
  const removeSearchEngine = useAppStore((state) => state.removeSearchEngine)
  const moveSearchEngine = useAppStore((state) => state.moveSearchEngine)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<SearchEngine | null>(null)

  const sortedEngines = useMemo(
    () => [...engines].sort((a, b) => a.sort - b.sort),
    [engines],
  )
  const defaultEngine = sortedEngines.find((engine) => engine.id === config.defaultEngineId)

  const openEditor = (id: string | null) => {
    setEditingId(id)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-5">
      <PanelHeader
        title="搜索设置"
        description="管理导航页顶部的搜索引擎。站内搜索卡片时也会优先出现匹配结果。"
        actions={
          <Button type="button" size="sm" onClick={() => openEditor(null)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            添加搜索引擎
          </Button>
        }
      />

      <SettingsSection title="搜索框">
        <SwitchRow
          label="显示搜索框"
          hint="关闭后，导航页仍可通过下方的搜索引擎设置重新开启。"
          checked={config.showSearch}
          onCheckedChange={(value) => updateConfig({ showSearch: value })}
        />
        <SwitchRow
          label="在新标签页中搜索"
          hint="关闭时，搜索结果会在当前标签页打开。"
          checked={config.searchInNewTab}
          onCheckedChange={(value) => updateConfig({ searchInNewTab: value })}
        />
        <div className="grid gap-4 pt-2 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="settings-search-placeholder">输入框提示文字</Label>
            <Input
              id="settings-search-placeholder"
              value={config.searchPlaceholder}
              onChange={(event) => updateConfig({ searchPlaceholder: event.target.value })}
              maxLength={120}
            />
          </div>
          <div className="space-y-2">
            <Label>当前默认搜索引擎</Label>
            <div className="flex h-10 items-center gap-2 rounded-lg border border-border/70 bg-muted/25 px-3 text-sm">
              {defaultEngine ? (
                <>
                  <NavIcon
                    icon={defaultEngine.icon}
                    iconColor={defaultEngine.iconColor}
                    title={defaultEngine.name}
                    size={18}
                  />
                  <span className="truncate">{defaultEngine.name}</span>
                </>
              ) : (
                <span className="text-muted-foreground">未设置</span>
              )}
              <Badge variant="outline" className="ml-auto text-[9px]">
                默认
              </Badge>
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title={`搜索引擎（${sortedEngines.length}）`}
        description="拖动顺序会影响菜单中的展示顺序，也可以直接点击星标设为默认。"
      >
        <div className="space-y-1.5">
          {sortedEngines.map((engine, index) => {
            const isDefault = engine.id === config.defaultEngineId
            return (
              <div
                key={engine.id}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors',
                  isDefault
                    ? 'border-primary/30 bg-primary/5'
                    : 'border-border/60 bg-background/30 hover:bg-muted/25',
                )}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/30">
                  <NavIcon icon={engine.icon} iconColor={engine.iconColor} title={engine.name} size={19} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-medium">{engine.name}</span>
                    {isDefault && (
                      <Badge className="h-4 px-1 text-[8px] font-normal">默认</Badge>
                    )}
                  </div>
                  <div className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
                    {engine.url}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      updateConfig({ defaultEngineId: engine.id })
                      toast.success(`默认搜索引擎：${engine.name}`)
                    }}
                    className={cn('text-muted-foreground', isDefault && 'text-amber-400')}
                    aria-label="设为默认"
                    title="设为默认"
                  >
                    <Star className={cn('h-3.5 w-3.5', isDefault && 'fill-current')} />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={index === 0}
                    onClick={() => moveSearchEngine(engine.id, -1)}
                    aria-label="上移"
                    title="上移"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={index === sortedEngines.length - 1}
                    onClick={() => moveSearchEngine(engine.id, 1)}
                    aria-label="下移"
                    title="下移"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => openEditor(engine.id)}
                    aria-label="编辑"
                    title="编辑"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={sortedEngines.length <= 1}
                    onClick={() => setPendingDelete(engine)}
                    className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
                    aria-label="删除"
                    title={sortedEngines.length <= 1 ? '至少保留一个搜索引擎' : '删除'}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-[10px] leading-relaxed text-muted-foreground">
          <Search className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            搜索地址中的 %s 会被替换为 URL 编码后的关键词。删除默认引擎后会自动选择列表中的第一个。
          </span>
        </div>
      </SettingsSection>

      <SettingsSection
        title="恢复与提示"
        description="如果误删了内置引擎，可以重新添加。常用示例："
      >
        <div className="space-y-1 rounded-lg bg-muted/25 p-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
          <div>Google · https://www.google.com/search?q=%s</div>
          <div>Bing · https://www.bing.com/search?q=%s</div>
          <div>百度 · https://www.baidu.com/s?wd=%s</div>
          <div>DuckDuckGo · https://duckduckgo.com/?q=%s</div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-3"
          onClick={() => openEditor(null)}
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          添加自定义引擎
        </Button>
      </SettingsSection>

      <SearchEngineDialog open={dialogOpen} engineId={editingId} onOpenChange={setDialogOpen} />

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(value) => !value && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除“{pendingDelete?.name}”？</AlertDialogTitle>
            <AlertDialogDescription>
              这个搜索引擎会从搜索菜单中移除。如果它是默认引擎，将会自动切换到列表中的第一个。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingDelete) {
                  removeSearchEngine(pendingDelete.id)
                  toast.success('搜索引擎已删除')
                }
                setPendingDelete(null)
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
