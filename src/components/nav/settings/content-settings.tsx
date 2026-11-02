import { useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ExternalLink,
  EyeOff,
  FolderPlus,
  GripVertical,
  Pencil,
  PencilLine,
  Plus,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { NavIcon } from '@/components/nav/nav-icon'
import { PanelHeader } from './settings-ui'
import { useAppStore } from '@/store/app-store'
import { useUiStore } from '@/store/ui-store'
import { cn } from '@/lib/utils'
import type { CardStyle, NavGroup } from '@/types'

const styleLabels: Record<CardStyle | 'inherit', string> = {
  inherit: '跟随全局',
  icon: '图标',
  card: '卡片',
  solid: '纯色',
  transparent: '透明',
}

export function ContentSettingsPanel() {
  const groups = useAppStore((state) => state.groups)
  const items = useAppStore((state) => state.items)
  const config = useAppStore((state) => state.config)
  const removeGroup = useAppStore((state) => state.removeGroup)
  const moveGroup = useAppStore((state) => state.moveGroup)
  const openGroupDialog = useUiStore((state) => state.openGroupDialog)
  const openAddItem = useUiStore((state) => state.openAddItem)
  const openEditItem = useUiStore((state) => state.openEditItem)
  const setEditMode = useUiStore((state) => state.setEditMode)
  const closeSettings = useUiStore((state) => state.closeSettings)
  const [pendingDelete, setPendingDelete] = useState<NavGroup | null>(null)

  const sortedGroups = useMemo(
    () => [...groups].sort((a, b) => a.sort - b.sort),
    [groups],
  )

  const deleteGroup = () => {
    if (!pendingDelete) return
    removeGroup(pendingDelete.id)
    toast.success(`分组“${pendingDelete.name}”已删除`)
    setPendingDelete(null)
  }

  const enterEditMode = () => {
    closeSettings()
    setEditMode(true)
  }

  return (
    <div className="space-y-5">
      <PanelHeader
        title="分组与内容"
        description="分组决定导航页的板块结构。卡片本身建议在导航页的编辑模式中直接拖拽排序。"
        actions={
          <Button type="button" size="sm" onClick={() => openGroupDialog(null)}>
            <FolderPlus className="mr-1.5 h-3.5 w-3.5" />
            新建分组
          </Button>
        }
      />

      <div className="rounded-2xl border border-border/70 bg-muted/20 p-3.5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <PencilLine className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">拖拽排序、编辑卡片</div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              进入编辑模式后可以拖动卡片手柄、跨分组移动卡片，也可以右键卡片进行更多操作。
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={enterEditMode}>
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            进入编辑模式
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {sortedGroups.map((group, index) => {
          const groupItems = items
            .filter((item) => item.groupId === group.id)
            .sort((a, b) => a.sort - b.sort)
          const style = group.style === 'inherit' ? config.defaultCardStyle : group.style
          return (
            <div
              key={group.id}
              className={cn(
                'rounded-2xl border border-border/70 bg-card/40 p-3.5 transition-colors hover:border-border',
                group.hidden && 'border-dashed',
              )}
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
                  <GripVertical className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-sm font-semibold">{group.name}</span>
                    <Badge variant="outline" className="h-4 px-1.5 text-[9px] font-normal">
                      {styleLabels[group.style]}
                      {group.style === 'inherit' && ` · ${styleLabels[style]}`}
                    </Badge>
                    <Badge variant="secondary" className="h-4 px-1.5 text-[9px] font-normal">
                      {groupItems.length} 张卡片
                    </Badge>
                    {group.hidden && (
                      <Badge className="h-4 gap-1 bg-amber-500/15 px-1.5 text-[9px] font-normal text-amber-500">
                        <EyeOff className="h-2.5 w-2.5" />
                        访客隐藏
                      </Badge>
                    )}
                    {group.collapsed && (
                      <Badge variant="outline" className="h-4 gap-1 px-1.5 text-[9px] font-normal">
                        <ChevronDown className="h-2.5 w-2.5" />
                        默认收起
                      </Badge>
                    )}
                  </div>
                  {group.description && (
                    <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">
                      {group.description}
                    </p>
                  )}

                  {groupItems.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      {groupItems.slice(0, 10).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => openEditItem(item.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-border/50 bg-muted/30 transition-colors hover:border-primary/30"
                          title={item.title}
                        >
                          <NavIcon
                            icon={item.icon}
                            iconColor={item.iconColor}
                            title={item.title}
                            size={15}
                          />
                        </button>
                      ))}
                      {groupItems.length > 10 && (
                        <span className="px-1 text-[10px] text-muted-foreground">
                          +{groupItems.length - 10}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={index === 0}
                    onClick={() => moveGroup(group.id, -1)}
                    aria-label="上移分组"
                    title="上移"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={index === sortedGroups.length - 1}
                    onClick={() => moveGroup(group.id, 1)}
                    aria-label="下移分组"
                    title="下移"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => openGroupDialog(group.id)}
                    aria-label="编辑分组"
                    title="编辑分组"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => openAddItem(group.id)}
                    aria-label="添加卡片"
                    title="添加卡片"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setPendingDelete(group)}
                    className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
                    aria-label="删除分组"
                    title="删除分组"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          )
        })}

        {sortedGroups.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
              <FolderPlus className="h-6 w-6 text-muted-foreground" />
            </span>
            <div>
              <div className="text-sm font-medium">还没有分组</div>
              <p className="mt-1 text-[11px] text-muted-foreground">先创建一个分组，再往里面添加卡片。</p>
            </div>
            <Button type="button" size="sm" onClick={() => openGroupDialog(null)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              创建第一个分组
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
        <span className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
          提示：删除分组会同时删除分组中的所有卡片。操作前建议先在“备份与恢复”中导出数据。
        </span>
      </div>

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(value) => !value && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除分组“{pendingDelete?.name}”？</AlertDialogTitle>
            <AlertDialogDescription>
              这个分组以及其中的{' '}
              {items.filter((item) => item.groupId === pendingDelete?.id).length} 张卡片都会被删除，
              此操作无法撤销。建议先导出备份。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={deleteGroup}
            >
              删除分组
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
