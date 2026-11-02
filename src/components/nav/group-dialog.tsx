import { useEffect, useState } from 'react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useAppStore } from '@/store/app-store'
import { useUiStore } from '@/store/ui-store'
import type { GroupStyle } from '@/types'

const styleOptions: Array<{ value: GroupStyle; label: string }> = [
  { value: 'inherit', label: '跟随全局样式' },
  { value: 'icon', label: '图标模式' },
  { value: 'card', label: '卡片模式' },
  { value: 'solid', label: '纯色卡片' },
  { value: 'transparent', label: '透明悬浮' },
]

export function GroupDialog() {
  const open = useUiStore((state) => state.groupDialogOpen)
  const editingGroupId = useUiStore((state) => state.editingGroupId)
  const close = useUiStore((state) => state.closeGroupDialog)
  const groups = useAppStore((state) => state.groups)
  const addGroup = useAppStore((state) => state.addGroup)
  const updateGroup = useAppStore((state) => state.updateGroup)
  const editingGroup = groups.find((group) => group.id === editingGroupId)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [style, setStyle] = useState<GroupStyle>('inherit')
  const [hidden, setHidden] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(editingGroup?.name ?? '')
    setDescription(editingGroup?.description ?? '')
    setStyle(editingGroup?.style ?? 'inherit')
    setHidden(editingGroup?.hidden ?? false)
    setCollapsed(editingGroup?.collapsed ?? false)
  }, [open, editingGroup])

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('请填写分组名称')
      return
    }

    if (editingGroup) {
      updateGroup(editingGroup.id, {
        name: trimmed,
        description: description.trim(),
        style,
        hidden,
        collapsed,
      })
      toast.success('分组已更新')
    } else {
      addGroup({ name: trimmed, description: description.trim(), style, hidden, collapsed })
      toast.success('分组已创建')
    }
    close()
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && close()}>
      <DialogContent className="max-w-md">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{editingGroup ? '编辑分组' : '新建分组'}</DialogTitle>
            <DialogDescription>
              分组可以拥有独立的卡片样式，也可以跟随站点默认样式。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="group-name">分组名称</Label>
            <Input
              id="group-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如：常用应用"
              autoFocus
              maxLength={40}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="group-description">描述（可选）</Label>
            <Textarea
              id="group-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="一句话介绍这个分组"
              className="min-h-[68px] resize-none"
              maxLength={120}
            />
          </div>

          <div className="space-y-2">
            <Label>卡片样式</Label>
            <Select value={style} onValueChange={(value) => setStyle(value as GroupStyle)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {styleOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3 rounded-xl border border-border/70 bg-muted/30 px-3.5 py-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="group-hidden" className="cursor-pointer">
                  对访客隐藏
                </Label>
                <p className="mt-0.5 text-[11px] text-muted-foreground">公开访问时不会显示这个分组</p>
              </div>
              <Switch id="group-hidden" checked={hidden} onCheckedChange={setHidden} />
            </div>
            <div className="h-px bg-border/60" />
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="group-collapsed" className="cursor-pointer">
                  默认收起
                </Label>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  卡片较多时默认折叠，访客仍可手动展开
                </p>
              </div>
              <Switch id="group-collapsed" checked={collapsed} onCheckedChange={setCollapsed} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={close}>
              取消
            </Button>
            <Button type="submit">{editingGroup ? '保存修改' : '创建分组'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
