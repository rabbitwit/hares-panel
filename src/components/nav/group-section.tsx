import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ItemCard } from '@/components/nav/item-card'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app-store'
import { useUiStore } from '@/store/ui-store'
import type { CardStyle, NavGroup, NavItem } from '@/types'

interface GroupSectionProps {
  group: NavGroup
  items: NavItem[]
  style: CardStyle
  isAdmin: boolean
  editMode: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  onDeleteGroup: (group: NavGroup) => void
  onMoveGroup: (id: string, direction: -1 | 1) => void
  onDeleteItem: (item: NavItem) => void
}

function SortableItem({
  item,
  group,
  style,
  isAdmin,
  editMode,
  onDeleteItem,
}: {
  item: NavItem
  group: NavGroup
  style: CardStyle
  isAdmin: boolean
  editMode: boolean
  onDeleteItem: (item: NavItem) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !editMode || !isAdmin,
    data: { type: 'item', groupId: group.id },
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.28 : 1,
      }}
      className={cn('relative min-w-0', isDragging && 'z-20')}
    >
      <ItemCard
        item={item}
        group={group}
        style={style}
        isAdmin={isAdmin}
        editMode={editMode}
        dragHandleProps={{ ...attributes, ...listeners }}
        onDeleteRequest={onDeleteItem}
      />
    </div>
  )
}

const ICON_TRACK_PX = 104

function useIconGridFillsRow(tileCount: number, enabled: boolean) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [fillsRow, setFillsRow] = useState(false)

  useLayoutEffect(() => {
    if (!enabled) {
      setFillsRow(false)
      return
    }

    const el = ref.current
    if (!el) return

    const update = () => {
      const width = el.getBoundingClientRect().width
      const columns = Math.floor(width / ICON_TRACK_PX)
      setFillsRow(columns > 1 && tileCount >= columns)
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [enabled, tileCount])

  return { ref, fillsRow }
}

function AddItemTile({ style, onClick }: { style: CardStyle; onClick: () => void }) {
  if (style !== 'icon') {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'nav-add-tile nav-add-tile-fill group flex w-full items-center justify-center gap-2 rounded-[var(--card-radius,16px)] text-[12px] font-medium',
          style === 'transparent' ? 'h-[64px]' : 'h-[78px]',
        )}
      >
        <span className="nav-add-tile-mark flex h-7 w-7 items-center justify-center rounded-full transition-transform group-hover:scale-105">
          <Plus className="h-3.5 w-3.5" />
        </span>
        添加卡片
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="nav-add-tile group flex min-h-[96px] flex-col items-center justify-center gap-2 rounded-[var(--card-radius,16px)] py-0.5 text-[12px] font-medium"
    >
      <span className="nav-add-tile-mark flex h-16 w-16 items-center justify-center rounded-[var(--card-radius,16px)] transition-transform group-hover:scale-105">
        <Plus className="h-5 w-5" />
      </span>
      添加卡片
    </button>
  )
}

export function GroupSection({
  group,
  items,
  style,
  isAdmin,
  editMode,
  canMoveUp,
  canMoveDown,
  onDeleteGroup,
  onMoveGroup,
  onDeleteItem,
}: GroupSectionProps) {
  const openAddItem = useUiStore((state) => state.openAddItem)
  const openGroupDialog = useUiStore((state) => state.openGroupDialog)
  const updateGroup = useAppStore((state) => state.updateGroup)
  const [collapsed, setCollapsed] = useState(Boolean(group.collapsed))

  useEffect(() => {
    // The persisted value is the default; visitors may expand a collapsed
    // group locally without writing anything back to the server.
    setCollapsed(Boolean(group.collapsed))
  }, [group.id, group.collapsed, isAdmin])

  const { setNodeRef, isOver } = useDroppable({
    id: `group:${group.id}`,
    data: { type: 'group', groupId: group.id },
    disabled: !editMode || !isAdmin || collapsed,
  })

  const tileCount = items.length + (isAdmin && editMode ? 1 : 0)
  const { ref: iconGridRef, fillsRow } = useIconGridFillsRow(
    tileCount,
    style === 'icon' && !collapsed && !(group.hidden && !isAdmin),
  )

  if (group.hidden && !isAdmin) return null

  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    if (isAdmin) updateGroup(group.id, { collapsed: next })
  }

  const contentId = `group-content-${group.id}`

  const gridClass =
    style === 'icon'
      ? // Icon rows span the full content width only when there are enough
        // tiles to fill a row: the first tile's left edge sits on the
        // content's left edge and the last tile's right edge on its right
        // edge.
        //
        // `auto-fit` drops columns that have no item, so leftover width is
        // free space rather than empty trailing tracks. `justify-between`
        // then spends that space on the gutters — but only if the group
        // actually fills a row. A short group (fewer tiles than columns)
        // keeps `justify-start` so a handful of icons stay compact on the
        // left instead of being stretched across the whole row.
        //
        // A track is 104px while the tile is 64px, so the tile is centred
        // with 20px of slack per side; `-mx-5` grows the grid by exactly
        // that slack at both ends, which puts the outermost tiles flush
        // with the group heading instead of 20px inside it.
        cn(
          'grid grid-cols-[repeat(auto-fit,104px)] -mx-5 gap-y-5 sm:gap-y-6',
          fillsRow ? 'justify-between' : 'justify-start',
        )
      : style === 'card'
        ? 'grid grid-cols-1 gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(250px,1fr))]'
        : style === 'solid'
          ? 'grid grid-cols-1 gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(245px,1fr))]'
          : 'grid grid-cols-1 gap-1.5 sm:grid-cols-[repeat(auto-fill,minmax(205px,1fr))]'

  return (
    <section
      ref={setNodeRef}
      id={`group-${group.id}`}
      data-collapsed={collapsed || undefined}
      className={cn('group-section relative scroll-mt-24', isOver && 'rounded-2xl')}
    >
      {isOver && (
        <div className="pointer-events-none absolute -inset-3 -z-10 rounded-3xl border border-dashed border-violet-400/40 bg-violet-400/5" />
      )}

      <div className="mb-3.5 flex min-h-7 items-end justify-between gap-3">
        <div className="flex min-w-0 items-end gap-2.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-shadow-nav truncate text-[17px] font-semibold tracking-tight nav-ink sm:text-[18px]">
                {group.name}
              </h2>
              {group.hidden && (
                <span className="rounded-full bg-amber-400/10 px-1.5 py-0.5 text-[9px] text-amber-300">
                  访客隐藏
                </span>
              )}
              {editMode && (
                <span className="nav-ink-soft rounded-full bg-foreground/8 px-1.5 py-0.5 text-[9px]">
                  {items.length} 张
                </span>
              )}
            </div>
            {group.description && (
              <p className="text-shadow-nav mt-0.5 hidden truncate text-[11px] font-normal nav-ink-soft sm:block">
                {group.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            aria-controls={contentId}
            aria-label={
              collapsed
                ? `展开分组 ${group.name}，共 ${items.length} 张卡片`
                : `收起分组 ${group.name}`
            }
            title={collapsed ? '展开分组' : '收起分组'}
            className="nav-item-surface nav-surface-ink flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-[10px] font-medium shadow-nav transition-colors hover:bg-foreground/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
          >
            <span className="hidden sm:inline">{collapsed ? '展开' : '收起'}</span>
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 transition-transform duration-200',
                collapsed && '-rotate-90',
              )}
            />
          </button>

          {isAdmin && editMode && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => openAddItem(group.id)}
                className="nav-item-surface nav-surface-ink shadow-nav hover:bg-foreground/12"
                aria-label={`向 ${group.name} 添加卡片`}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="nav-item-surface nav-surface-ink shadow-nav hover:bg-foreground/12"
                    aria-label="分组操作"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => openGroupDialog(group.id)}>
                    <Pencil />
                    编辑分组
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openAddItem(group.id)}>
                    <Plus />
                    添加卡片
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled={!canMoveUp} onClick={() => onMoveGroup(group.id, -1)}>
                    <ArrowUp />
                    上移分组
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={!canMoveDown} onClick={() => onMoveGroup(group.id, 1)}>
                    <ArrowDown />
                    下移分组
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem destructive onClick={() => onDeleteGroup(group)}>
                    <Trash2 />
                    删除分组
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>

      {!collapsed && (
        <SortableContext items={items.map((item) => item.id)} strategy={rectSortingStrategy}>
          <div id={contentId} ref={iconGridRef} className={gridClass}>
            {items.map((item) => (
              <SortableItem
                key={item.id}
                item={item}
                group={group}
                style={style}
                isAdmin={isAdmin}
                editMode={editMode}
                onDeleteItem={onDeleteItem}
              />
            ))}
            {isAdmin && editMode && (
              <AddItemTile style={style} onClick={() => openAddItem(group.id)} />
            )}
          </div>
        </SortableContext>
      )}
    </section>
  )
}
