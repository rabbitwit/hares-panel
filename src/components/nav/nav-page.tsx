import { useMemo, useState } from 'react'
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import {
  FolderPlus,
  LayoutGrid,
  PencilLine,
  Plus,
  Trash2,
  Wifi,
} from 'lucide-react'
import { toast } from 'sonner'
import { NavBackground } from '@/components/nav/background'
import { NavHeader } from '@/components/nav/nav-header'
import { SearchBar } from '@/components/nav/search-bar'
import { SystemStatus } from '@/components/nav/system-status'
import { GroupSection } from '@/components/nav/group-section'
import { ItemCard } from '@/components/nav/item-card'
import { TopControls } from '@/components/nav/top-controls'
import { FloatingDock } from '@/components/nav/floating-dock'
import { SettingsDialog } from '@/components/nav/settings-dialog'
import { GalleryDialog } from '@/components/nav/gallery-dialog'
import { GroupDialog } from '@/components/nav/group-dialog'
import { ItemDialog } from '@/components/nav/item-dialog'
import { Button } from '@/components/ui/button'
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
import { useAppStore } from '@/store/app-store'
import { useSessionStore } from '@/store/session-store'
import { useUiStore } from '@/store/ui-store'
import { cn } from '@/lib/utils'
import type { CardStyle, NavGroup, NavItem } from '@/types'
import type { CSSProperties } from 'react'

export function NavPage() {
  const config = useAppStore((state) => state.config)
  const groups = useAppStore((state) => state.groups)
  const items = useAppStore((state) => state.items)
  const moveGroup = useAppStore((state) => state.moveGroup)
  const removeGroup = useAppStore((state) => state.removeGroup)
  const removeItem = useAppStore((state) => state.removeItem)
  const moveItem = useAppStore((state) => state.moveItem)
  const session = useSessionStore((state) => state.session)
  const editMode = useUiStore((state) => state.editMode)
  const setEditMode = useUiStore((state) => state.setEditMode)
  const openGroupDialog = useUiStore((state) => state.openGroupDialog)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeWidth, setActiveWidth] = useState(220)
  const [pendingGroupDelete, setPendingGroupDelete] = useState<NavGroup | null>(null)
  const [pendingItemDelete, setPendingItemDelete] = useState<NavItem | null>(null)

  const user = session
  const isAdmin = Boolean(session)
  const editing = Boolean(isAdmin && editMode)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const sortedGroups = useMemo(() => [...groups].sort((a, b) => a.sort - b.sort), [groups])

  const visibleGroups = useMemo(() => {
    return sortedGroups
      // Hidden content stays visible to a signed-in admin so it can be
      // managed; only visitors get the filtered view.
      .filter((group) => isAdmin || !group.hidden)
      .map((group) => ({
        group,
        items: items
          .filter((item) => item.groupId === group.id)
          .filter((item) => isAdmin || !item.hidden)
          .sort((a, b) => a.sort - b.sort),
      }))
      .filter((entry) => isAdmin || entry.items.length > 0)
  }, [isAdmin, items, sortedGroups])

  const activeItem = activeId ? items.find((item) => item.id === activeId) : null
  const activeGroup = activeItem ? groups.find((group) => group.id === activeItem.groupId) : null
  const activeStyle: CardStyle = activeGroup
    ? activeGroup.style === 'inherit'
      ? config.defaultCardStyle
      : activeGroup.style
    : config.defaultCardStyle

  const handleDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id)
    setActiveId(id)
    setActiveWidth(event.active.rect.current.initial?.width ?? 220)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const id = String(event.active.id)
    const over = event.over
    setActiveId(null)
    setActiveWidth(220)
    if (!over || over.id === id) return

    const active = items.find((item) => item.id === id)
    if (!active) return
    const overId = String(over.id)
    let targetGroupId = ''
    let targetIndex = 0

    if (overId.startsWith('group:')) {
      targetGroupId = overId.slice('group:'.length)
      targetIndex = items
        .filter((item) => item.groupId === targetGroupId && item.id !== id)
        .sort((a, b) => a.sort - b.sort).length
    } else {
      const overItem = items.find((item) => item.id === overId)
      if (!overItem) return
      targetGroupId = overItem.groupId
      const targetItems = items
        .filter((item) => item.groupId === targetGroupId && item.id !== id)
        .sort((a, b) => a.sort - b.sort)
      const overIndex = targetItems.findIndex((item) => item.id === overItem.id)
      if (overIndex < 0) return
      targetIndex =
        targetGroupId === active.groupId
          ? overIndex + (active.sort < overItem.sort ? 1 : 0)
          : overIndex
    }

    if (targetGroupId === active.groupId) {
      const currentIndex = items
        .filter((item) => item.groupId === active.groupId)
        .sort((a, b) => a.sort - b.sort)
        .findIndex((item) => item.id === active.id)
      if (targetIndex === currentIndex) return
    }

    moveItem(active.id, targetGroupId, targetIndex)
    if (targetGroupId !== active.groupId) {
      const targetGroup = groups.find((group) => group.id === targetGroupId)
      if (targetGroup) toast.success(`已移动到“${targetGroup.name}”`)
    }
  }

  const styleVars = {
    '--card-radius': `${config.cardRadius}px`,
    '--card-blur': config.glassEffect ? '14px' : '0px',
  } as CSSProperties

  const empty = visibleGroups.length === 0

  return (
    <div
      className="relative min-h-[100dvh] overflow-x-hidden"
      style={styleVars}
    >
      <NavBackground />
      <TopControls />

      <main className="relative z-10 mx-auto w-full max-w-[1180px] px-4 pb-28 pt-16 sm:px-6 sm:pt-20 lg:px-8">
        {editing && (
          <div className="mx-auto mb-6 flex w-fit max-w-full items-center gap-2 rounded-full border border-violet-500/25 bg-violet-500/10 px-3.5 py-1.5 text-[10px] text-violet-700 shadow-lg backdrop-blur-xl dark:border-violet-300/20 dark:bg-violet-500/15 dark:text-violet-100 sm:text-[11px]">
            <PencilLine className="h-3 w-3 shrink-0" />
            <span className="truncate">
              编辑模式已开启 · 拖动卡片左上角手柄排序，右键卡片管理
            </span>
            <button
              type="button"
              onClick={() => setEditMode(false)}
              className="ml-1 shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium text-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground"
            >
              完成
            </button>
          </div>
        )}

        <NavHeader />

        {config.showSearch && (
          <div className="mx-auto mt-8 w-full max-w-[680px] sm:mt-9">
            <SearchBar />
          </div>
        )}

        {empty ? (
          <div className="mx-auto mt-16 max-w-md rounded-3xl border border-foreground/10 bg-foreground/5 px-6 py-12 text-center backdrop-blur-xl sm:mt-20">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-foreground/10 bg-foreground/8 text-foreground/40">
              <LayoutGrid className="h-6 w-6" />
            </span>
            <h2 className="text-shadow-nav mt-4 text-lg font-semibold nav-ink">这里还很安静</h2>
            <p className="mx-auto mt-1.5 max-w-xs text-[11px] leading-relaxed text-foreground/40">
              {isAdmin
                ? '创建第一个分组，然后添加你每天都会打开的网站和 NAS 服务。'
                : '管理员还没有公开任何导航内容，请稍后再来看看。'}
            </p>
            {isAdmin && (
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setEditMode(true)
                    openGroupDialog(null)
                  }}
                >
                  <FolderPlus className="mr-1.5 h-3.5 w-3.5" />
                  创建分组
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="glass"
                  onClick={() => setEditMode(true)}
                >
                  <PencilLine className="mr-1.5 h-3.5 w-3.5" />
                  进入编辑模式
                </Button>
              </div>
            )}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => {
              setActiveId(null)
              setActiveWidth(220)
            }}
          >
            <div className="mt-12 space-y-9 sm:mt-14 sm:space-y-10">
              {visibleGroups.map(({ group, items: groupItems }, index) => (
                <GroupSection
                  key={group.id}
                  group={group}
                  items={groupItems}
                  style={group.style === 'inherit' ? config.defaultCardStyle : group.style}
                  isAdmin={Boolean(isAdmin)}
                  editMode={editing}
                  canMoveUp={index > 0}
                  canMoveDown={index < visibleGroups.length - 1}
                  onDeleteGroup={setPendingGroupDelete}
                  onMoveGroup={moveGroup}
                  onDeleteItem={setPendingItemDelete}
                />
              ))}

              {editing && (
                <button
                  type="button"
                  onClick={() => openGroupDialog(null)}
                  className="nav-add-tile nav-add-tile-fill group flex w-full items-center justify-center gap-2 rounded-2xl py-5 text-xs font-medium"
                >
                  <span className="nav-add-tile-mark flex h-7 w-7 items-center justify-center rounded-full transition-transform group-hover:scale-105">
                    <Plus className="h-3.5 w-3.5" />
                  </span>
                  新建分组
                </button>
              )}
            </div>

            <DragOverlay dropAnimation={null} className="pointer-events-none">
              {activeItem && (
                <div
                  className="opacity-95 drop-shadow-2xl"
                  style={{ width: activeWidth, ['--card-radius' as string]: `${config.cardRadius}px` }}
                >
                  <ItemCard
                    item={activeItem}
                    group={activeGroup ?? undefined}
                    style={activeStyle}
                    isAdmin={false}
                    editMode={false}
                    presentation
                  />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}

        <SystemStatus />

        {config.footerEnabled && (
          <footer className="mt-14 text-center text-[10px] leading-relaxed nav-ink-soft-2 sm:mt-16">
            {config.footerHtml ? (
              <div
                className="footer-html"
                dangerouslySetInnerHTML={{ __html: config.footerHtml }}
              />
            ) : (
              <div className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
                <span>{config.footerText}</span>
              </div>
            )}
          </footer>
        )}
      </main>

      <FloatingDock />
      <SettingsDialog />
      <GalleryDialog />
      <GroupDialog />
      <ItemDialog />

      <AlertDialog
        open={Boolean(pendingGroupDelete)}
        onOpenChange={(value) => !value && setPendingGroupDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除分组“{pendingGroupDelete?.name}”？</AlertDialogTitle>
            <AlertDialogDescription>
              分组中的{' '}
              {items.filter((item) => item.groupId === pendingGroupDelete?.id).length} 张卡片
              将一并删除。此操作无法撤销，建议先导出备份。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingGroupDelete) {
                  removeGroup(pendingGroupDelete.id)
                  toast.success('分组已删除')
                }
                setPendingGroupDelete(null)
              }}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              删除分组
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(pendingItemDelete)}
        onOpenChange={(value) => !value && setPendingItemDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除卡片“{pendingItemDelete?.title}”？</AlertDialogTitle>
            <AlertDialogDescription>
              这张卡片会从导航页移除，此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingItemDelete) {
                  removeItem(pendingItemDelete.id)
                  toast.success('卡片已删除')
                }
                setPendingItemDelete(null)
              }}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              删除卡片
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {!isAdmin && (
        <div className="pointer-events-none fixed bottom-4 left-4 z-30 hidden items-center gap-1.5 rounded-full border border-foreground/8 bg-background/40 px-2.5 py-1 text-[9px] text-foreground/35 backdrop-blur-md sm:flex">
          <Wifi className="h-2.5 w-2.5" />
          {user ? '管理员会话' : '访客浏览'}
          <span className={cn('h-1 w-1 rounded-full', config.publicAccess ? 'bg-emerald-400' : 'bg-amber-400')} />
        </div>
      )}
    </div>
  )
}
