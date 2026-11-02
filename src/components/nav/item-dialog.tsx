import { useEffect, useMemo, useState } from 'react'
import { Loader2, WandSparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { NavIcon } from '@/components/nav/nav-icon'
import { IconPicker } from '@/components/nav/icon-picker'
import { useAppStore } from '@/store/app-store'
import { useUiStore } from '@/store/ui-store'
import { findFavicon } from '@/lib/favicon'
import { normalizeUrl } from '@/lib/utils'
import type { OpenMode } from '@/types'

const openModes: Array<{ value: OpenMode; label: string; hint: string }> = [
  { value: 'new', label: '新标签页', hint: '默认方式' },
  { value: 'self', label: '当前页面', hint: '直接跳转' },
]

export function ItemDialog() {
  const open = useUiStore((state) => state.itemDialogOpen)
  const editingItemId = useUiStore((state) => state.editingItemId)
  const initialGroupId = useUiStore((state) => state.itemDialogGroupId)
  const close = useUiStore((state) => state.closeItemDialog)
  const groups = useAppStore((state) => state.groups)
  const items = useAppStore((state) => state.items)
  const addItem = useAppStore((state) => state.addItem)
  const updateItem = useAppStore((state) => state.updateItem)
  const removeItem = useAppStore((state) => state.removeItem)
  const defaultOpenMode = useAppStore((state) => state.config.defaultOpenMode)

  const sortedGroups = useMemo(() => [...groups].sort((a, b) => a.sort - b.sort), [groups])
  const editingItem = items.find((entry) => entry.id === editingItemId)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [groupId, setGroupId] = useState('')
  const [url, setUrl] = useState('')
  const [lanUrl, setLanUrl] = useState('')
  const [icon, setIcon] = useState('')
  const [iconColor, setIconColor] = useState('')
  const [suggestingIcon, setSuggestingIcon] = useState(false)
  const [badge, setBadge] = useState('')
  const [openMode, setOpenMode] = useState<OpenMode>('new')
  const [hidden, setHidden] = useState(false)
  const [iconPickerOpen, setIconPickerOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const fallbackGroup = sortedGroups[0]?.id ?? ''
    if (editingItem) {
      setTitle(editingItem.title)
      setDescription(editingItem.description)
      setGroupId(editingItem.groupId)
      setUrl(editingItem.url)
      setLanUrl(editingItem.lanUrl)
      setIcon(editingItem.icon)
      setIconColor(editingItem.iconColor)
      setBadge(editingItem.badge)
      setOpenMode(editingItem.openMode)
      setHidden(editingItem.hidden)
    } else {
      setTitle('')
      setDescription('')
      setGroupId(initialGroupId ?? fallbackGroup)
      setUrl('')
      setLanUrl('')
      setIcon('')
      setIconColor('')
      setBadge('')
      setOpenMode(defaultOpenMode)
      setHidden(false)
    }
    setIconPickerOpen(false)
    setDeleteOpen(false)
  }, [defaultOpenMode, editingItem, initialGroupId, open, sortedGroups])

  const useSuggestedIcon = async () => {
    const input = lanUrl.trim() || url.trim()
    if (!input) {
      toast.error('请先填写网址')
      return
    }
    setSuggestingIcon(true)
    try {
      const suggested = await findFavicon(input)
      if (!suggested) {
        toast.error('没有找到可用图标，请手动选择')
        return
      }
      setIcon(suggested)
      setIconColor('')
      toast.success('已获取网站图标，如果显示异常可手动选择')
    } catch {
      toast.error('自动获取图标失败，请手动选择')
    } finally {
      setSuggestingIcon(false)
    }
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      toast.error('请填写卡片名称')
      return
    }
    if (!groupId) {
      toast.error('请先创建一个分组')
      return
    }
    if (!url.trim() && !lanUrl.trim()) {
      toast.error('请至少填写一个访问地址')
      return
    }

    const payload = {
      groupId,
      title: trimmedTitle,
      description: description.trim(),
      url: normalizeUrl(url),
      lanUrl: normalizeUrl(lanUrl),
      icon,
      iconColor,
      badge: badge.trim(),
      openMode,
      hidden,
    }

    if (editingItem) {
      updateItem(editingItem.id, payload)
      toast.success('卡片已更新')
    } else {
      addItem(payload)
      toast.success('卡片已添加')
    }
    close()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(value) => !value && close()}>
        <DialogContent className="max-h-[92dvh] max-w-2xl overflow-hidden p-0">
          <form onSubmit={submit} className="flex max-h-[92dvh] flex-col">
            <div className="border-b border-border/70 px-6 py-5">
              <DialogHeader>
                <DialogTitle>{editingItem ? '编辑卡片' : '添加卡片'}</DialogTitle>
                <DialogDescription>
                  配置名称、地址和图标。内部地址可在网络切换时优先使用。
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="styled-scrollbar min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="flex flex-col items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIconPickerOpen(true)}
                    className="group flex h-20 w-20 items-center justify-center rounded-2xl border border-border bg-muted/40 transition-all hover:border-primary/40 hover:bg-muted/60"
                    aria-label="选择图标"
                  >
                    <NavIcon icon={icon} iconColor={iconColor} title={title || '卡片'} size={38} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIconPickerOpen(true)}
                    className="text-[11px] font-medium text-primary hover:underline"
                  >
                    选择图标
                  </button>
                </div>

                <div className="grid flex-1 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="item-title">卡片名称</Label>
                    <Input
                      id="item-title"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="例如：Home Assistant"
                      maxLength={50}
                      autoFocus
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>所属分组</Label>
                      <Select value={groupId} onValueChange={setGroupId}>
                        <SelectTrigger>
                          <SelectValue placeholder="选择分组" />
                        </SelectTrigger>
                        <SelectContent>
                          {sortedGroups.map((group) => (
                            <SelectItem key={group.id} value={group.id}>
                              {group.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="item-badge">角标（可选）</Label>
                      <Input
                        id="item-badge"
                        value={badge}
                        onChange={(event) => setBadge(event.target.value)}
                        placeholder="NEW / NAS"
                        maxLength={10}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="item-description">描述（可选）</Label>
                    <Textarea
                      id="item-description"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="一句话说明这个应用"
                      className="min-h-[64px] resize-none"
                      maxLength={160}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-xl border border-border/70 bg-muted/20 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">访问地址</div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      内网地址可留空，右键卡片也能切换地址打开。
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void useSuggestedIcon()}
                    disabled={suggestingIcon}
                  >
                    {suggestingIcon ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <WandSparkles className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {suggestingIcon ? '获取中…' : '自动取图标'}
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="item-url">默认 / 外网地址</Label>
                  <Input
                    id="item-url"
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="https://example.com"
                    inputMode="url"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="item-lan-url">内网地址（可选）</Label>
                  <Input
                    id="item-lan-url"
                    value={lanUrl}
                    onChange={(event) => setLanUrl(event.target.value)}
                    placeholder="http://192.168.1.10:8080"
                    inputMode="url"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label>打开方式</Label>
                <RadioGroup
                  value={openMode}
                  onValueChange={(value) => setOpenMode(value as OpenMode)}
                  className="grid grid-cols-2 gap-2"
                >
                  {openModes.map((mode) => (
                    <label
                      key={mode.value}
                      htmlFor={`open-${mode.value}`}
                      className={`flex cursor-pointer flex-col gap-1 rounded-xl border p-3 transition-colors ${
                        openMode === mode.value
                          ? 'border-primary/50 bg-primary/5'
                          : 'border-border/70 hover:bg-muted/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">{mode.label}</span>
                        <RadioGroupItem value={mode.value} id={`open-${mode.value}`} />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{mode.hint}</span>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
                <div>
                  <Label htmlFor="item-hidden" className="cursor-pointer">
                    对访客隐藏
                  </Label>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    卡片仅在编辑模式和管理员登录时可见
                  </p>
                </div>
                <Switch id="item-hidden" checked={hidden} onCheckedChange={setHidden} />
              </div>
            </div>

            <DialogFooter className="flex-row items-center justify-between gap-2 border-t border-border/70 px-6 py-4 sm:space-x-0">
              <div>
                {editingItem && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
                    onClick={() => setDeleteOpen(true)}
                  >
                    删除卡片
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={close}>
                  取消
                </Button>
                <Button type="submit">{editingItem ? '保存修改' : '添加卡片'}</Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <IconPicker
        open={iconPickerOpen}
        onOpenChange={setIconPickerOpen}
        value={icon}
        color={iconColor}
        title={title}
        onSelect={(nextIcon, nextColor) => {
          setIcon(nextIcon)
          setIconColor(nextColor)
        }}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这张卡片？</AlertDialogTitle>
            <AlertDialogDescription>
              “{editingItem?.title}”将从导航页移除，此操作无法撤销。你可以先导出备份。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (editingItem) {
                  removeItem(editingItem.id)
                  toast.success('卡片已删除')
                }
                close()
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
