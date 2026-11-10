import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import {
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Globe2,
  GripVertical,
  House,
  Link2,
  Pencil,
  SquareArrowOutUpRight,
  Trash2,
  CopyPlus,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { NavIcon } from '@/components/nav/nav-icon'
import { useOpenItem } from '@/hooks/use-open-item'
import { useAppStore } from '@/store/app-store'
import { useUiStore } from '@/store/ui-store'
import { resolveItemUrl } from '@/lib/network'
import { brandColorForIcon, brandColorForUrl } from '@/lib/brand-color'
import { cn, colorWithAlpha, colorFromString, getDomain, copyText, readableTextColor } from '@/lib/utils'
import type { CardStyle, NavGroup, NavItem } from '@/types'

function useOpenOnLongPress(onOpen: () => void) {
  const timerRef = useRef(0)
  const suppressClickRef = useRef(false)
  const startRef = useRef({ x: 0, y: 0 })

  const clearTimer = useCallback(() => {
    if (!timerRef.current) return
    window.clearTimeout(timerRef.current)
    timerRef.current = 0
  }, [])

  useEffect(() => () => clearTimer(), [clearTimer])

  const onPointerDown = useCallback(
    (event: ReactPointerEvent) => {
      if (event.pointerType === 'mouse') return
      suppressClickRef.current = false
      startRef.current = { x: event.clientX, y: event.clientY }
      clearTimer()
      timerRef.current = window.setTimeout(() => {
        timerRef.current = 0
        suppressClickRef.current = true
        onOpen()
      }, 520)
    },
    [clearTimer, onOpen],
  )

  const onPointerMove = useCallback(
    (event: ReactPointerEvent) => {
      if (!timerRef.current) return
      const dx = event.clientX - startRef.current.x
      const dy = event.clientY - startRef.current.y
      if (dx * dx + dy * dy > 64) clearTimer()
    },
    [clearTimer],
  )

  const didLongPress = useCallback(() => {
    if (!suppressClickRef.current) return false
    suppressClickRef.current = false
    return true
  }, [])

  return {
    didLongPress,
    pointerHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: clearTimer,
      onPointerCancel: clearTimer,
    },
  }
}

interface ItemCardProps {
  item: NavItem
  group?: NavGroup
  style: CardStyle
  isAdmin: boolean
  editMode: boolean
  dragHandleProps?: Record<string, unknown>
  onDeleteRequest?: (item: NavItem) => void
  presentation?: boolean
  className?: string
}

export function ItemCard({
  item,
  style,
  isAdmin,
  editMode,
  dragHandleProps,
  onDeleteRequest,
  presentation = false,
  className,
}: ItemCardProps) {
  const { openItem } = useOpenItem()
  const openEditItem = useUiStore((state) => state.openEditItem)
  const updateItem = useAppStore((state) => state.updateItem)
  const duplicateItem = useAppStore((state) => state.duplicateItem)
  const networkMode = useAppStore((state) => state.config.networkMode)
  const iconRadius = useAppStore((state) => state.config.iconRadius)
  const iconRadiusEnabled = useAppStore((state) => state.config.iconRadiusEnabled)
  const glassEffect = useAppStore((state) => state.config.glassEffect)
  const effectiveUrl = resolveItemUrl(item, networkMode)
  const [menuOpen, setMenuOpen] = useState(false)
  const openMenu = useCallback(() => setMenuOpen(true), [])
  const { didLongPress, pointerHandlers } = useOpenOnLongPress(openMenu)

  useEffect(() => {
    if (!menuOpen) return
    // Non-modal menus don't lock scrolling; close instead of leaving the menu
    // detached from its card while the page moves.
    const close = () => setMenuOpen(false)
    window.addEventListener('scroll', close, true)
    return () => window.removeEventListener('scroll', close, true)
  }, [menuOpen])

  const isEditing = editMode && isAdmin
  const openInNewTab = item.openMode !== 'self'

  const handleActivate = useCallback(() => {
    if (isEditing) {
      openEditItem(item.id)
      return
    }
    openItem(item)
  }, [isEditing, item, openEditItem, openItem])

  const copyLink = async () => {
    const url = effectiveUrl || item.url || item.lanUrl
    if (!url) {
      toast.error('这个卡片还没有地址')
      return
    }
    const ok = await copyText(url)
    if (ok) toast.success('链接已复制')
  }

  // Cards can carry an icon id (looked up by name), a scraped favicon (looked
  // up by the site it renders), or neither -- then the title picks a stable
  // colour so the card still has an identity.
  const accent =
    item.iconColor ||
    brandColorForIcon(item.icon) ||
    brandColorForUrl(item.icon) ||
    brandColorForUrl(effectiveUrl || item.url || item.lanUrl) ||
    colorFromString(item.title)
  const tintSoft = colorWithAlpha(accent, 0.1)
  const solidForeground = readableTextColor(accent)
  const isHorizontal = style === 'card' || style === 'transparent' || style === 'solid'
  const iconSize = style === 'icon' ? 36 : style === 'solid' ? 26 : style === 'card' ? 25 : 30
  const tileStyle = {
    background:
      style === 'icon'
        ? glassEffect
          ? undefined
          : `radial-gradient(circle at 30% 15%, ${tintSoft}, transparent 70%), rgba(var(--nav-tile-rgb), .075)`
        : style === 'card'
          ? `radial-gradient(circle at 30% 15%, ${tintSoft}, transparent 75%), rgba(var(--nav-tile-rgb), .08)`
          : undefined,
  } as CSSProperties

  const iconTile = (
    <span
      className={cn(
        'relative flex shrink-0 items-center justify-center transition-all duration-300',
        style === 'icon' && 'nav-icon-tile h-16 w-16 shrink-0 overflow-hidden rounded-[var(--card-radius,16px)] group-hover/card:scale-105 group-hover/card:shadow-glow',
        style === 'solid' &&
          'h-10 w-10 rounded-xl border border-white/25 bg-white/15 group-hover/card:bg-white/20',
        style === 'card' && 'h-11 w-11 rounded-[13px] border border-foreground/10 bg-foreground/8',
        style === 'transparent' && 'h-9 w-9 rounded-xl',
        glassEffect && style === 'icon' && 'nav-glass-tile is-glass',
      )}
      style={tileStyle}
    >
      <NavIcon
        icon={item.icon}
        iconColor={style === 'solid' ? undefined : item.iconColor}
        title={item.title}
        size={iconSize}
        radius={iconRadiusEnabled ? iconRadius : 0}
        silhouette={style === 'solid'}
      />
      {item.badge && style !== 'solid' && (
        <span className="absolute -right-1.5 -top-1.5 rounded-full border border-foreground/20 bg-gradient-to-r from-violet-500 to-fuchsia-500 px-1.5 py-0.5 text-[8px] font-semibold leading-none text-white shadow-lg">
          {item.badge}
        </span>
      )}
      {isAdmin && editMode && item.hidden && style === 'icon' && (
        <span
          className="absolute -bottom-1 -left-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-amber-300 shadow-md ring-1 ring-black/30"
          title="访客不可见"
        >
          <EyeOff className="h-3 w-3" />
        </span>
      )}
    </span>
  )

  const titleAndDescription = (
    <span className={cn('min-w-0', isHorizontal ? 'flex-1 text-left' : 'w-full text-center')}>
      <span
        className={cn(
          'block truncate font-medium',
          style === 'solid' && 'text-[13.5px] text-current',
          style === 'icon' && 'nav-ink-on-wallpaper text-[12.5px]',
          style === 'transparent' && 'nav-ink-on-wallpaper text-[13px]',
          style === 'card' && 'nav-ink-card-pane text-[14px]',
        )}
      >
        {item.title}
      </span>
      {item.description && style !== 'icon' && (
        <span
          className={cn(
            'mt-0.5 block truncate text-[11px] font-normal',
            style === 'solid' && 'text-current opacity-70',
            style === 'transparent' && 'nav-ink-on-wallpaper-soft',
            style === 'card' && 'nav-ink-card-pane-soft',
          )}
        >
          {item.description}
        </span>
      )}
    </span>
  )

  const cardClassName = cn(
    'group/card relative outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-foreground/40',
    'select-none text-inherit no-underline',
    style === 'icon' && 'flex cursor-pointer flex-col items-center gap-2 rounded-xl py-0.5',
    style === 'solid' &&
      'flex h-[78px] cursor-pointer items-center gap-3 rounded-[var(--card-radius,16px)] border border-white/20 px-3.5 hover:-translate-y-0.5 hover:brightness-105',
    style === 'card' &&
      cn(
        'nav-item-surface flex h-[78px] cursor-pointer items-center gap-3 rounded-[var(--card-radius,16px)] px-3.5 hover:-translate-y-0.5',
        glassEffect
          ? 'nav-card-glass is-card-glass'
          : 'hover:bg-foreground/12 hover:shadow-nav',
      ),
    style === 'transparent' &&
      cn(
        'flex h-[64px] cursor-pointer items-center gap-3 rounded-[var(--card-radius,16px)] border px-2.5',
        glassEffect
          ? 'nav-card-glass is-card-glass-on-hover'
          : 'border-transparent hover:border-foreground/10 hover:bg-foreground/7',
      ),
    editMode && 'ring-1 ring-foreground/10 ring-offset-0 hover:ring-foreground/25',
    item.hidden && !isAdmin && 'hidden',
    className,
  )
  const cardStyle: CSSProperties | undefined =
    style === 'solid'
      ? {
          color: solidForeground,
          background: `linear-gradient(135deg, ${colorWithAlpha(accent, 0.96)}, ${colorWithAlpha(accent, 0.76)})`,
          boxShadow: `0 18px 38px -26px ${colorWithAlpha(accent, 0.9)}`,
          WebkitTouchCallout: 'none',
        }
      : { WebkitTouchCallout: 'none' }

  const cardInner = (
    <>
      {iconTile}
      {titleAndDescription}

      {(style === 'card' || style === 'solid') && item.badge && (
        <span
          className={cn(
            'absolute right-3 top-3 rounded-full px-1.5 py-0.5 text-[9px]',
            style === 'solid' ? 'bg-black/25 text-current' : 'bg-foreground/10 text-foreground/60',
          )}
        >
          {item.badge}
        </span>
      )}

      {isAdmin && editMode && item.hidden && style !== 'icon' && (
        <span className="absolute bottom-1 left-1 rounded-full bg-black/60 p-1 text-amber-300" title="访客不可见">
          <EyeOff className="h-3 w-3" />
        </span>
      )}

      {isEditing && (
        <>
          <button
            type="button"
            aria-label="拖动排序"
            className="drag-handle absolute -left-1 -top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-foreground/15 bg-background/90 text-foreground/55 opacity-100 shadow-lg backdrop-blur transition-opacity focus-visible:opacity-100 sm:opacity-0 sm:group-hover/card:opacity-100"
            onClick={(event) => event.stopPropagation()}
            {...dragHandleProps}
          >
            <GripVertical className="h-3 w-3" />
          </button>
          <button
            type="button"
            aria-label="编辑卡片"
            className="absolute -right-1 -top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-foreground/15 bg-background/90 text-foreground/70 opacity-100 shadow-lg backdrop-blur transition-opacity focus-visible:opacity-100 sm:opacity-0 sm:group-hover/card:opacity-100"
            onClick={(event) => {
              event.stopPropagation()
              openEditItem(item.id)
            }}
          >
            <Pencil className="h-3 w-3" />
          </button>
        </>
      )}
    </>
  )

  // Real <a href> so mobile Chrome treats this as a new browser tab instead of
  // a VIEW intent that silently launches an installed app. Edit mode stays a
  // div so drag/edit buttons are not nested inside a link.
  const cardBody = isEditing ? (
    <div
      role="link"
      tabIndex={0}
      aria-label={item.title}
      onClick={() => {
        if (didLongPress()) return
        handleActivate()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          handleActivate()
        }
      }}
      className={cardClassName}
      style={cardStyle}
      {...pointerHandlers}
    >
      {cardInner}
    </div>
  ) : (
    <a
      href={effectiveUrl || undefined}
      target={effectiveUrl && openInNewTab ? '_blank' : undefined}
      rel={effectiveUrl && openInNewTab ? 'noopener noreferrer' : undefined}
      draggable={false}
      aria-label={item.title}
      onClick={(event) => {
        if (didLongPress()) {
          event.preventDefault()
          return
        }
        if (!effectiveUrl) {
          event.preventDefault()
          toast.error('这个卡片还没有配置地址')
        }
      }}
      className={cardClassName}
      style={cardStyle}
      {...pointerHandlers}
    >
      {cardInner}
    </a>
  )

  if (presentation) {
    return cardBody
  }

  return (
    <ContextMenu modal={false} open={menuOpen} onOpenChange={setMenuOpen}>
      <ContextMenuTrigger asChild>{cardBody}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuLabel className="flex items-center justify-between gap-4">
          <span className="truncate text-foreground">{item.title}</span>
          <span className="truncate font-normal text-muted-foreground">{getDomain(effectiveUrl)}</span>
        </ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => openItem(item)}>
          <SquareArrowOutUpRight />
          打开卡片
        </ContextMenuItem>
        <ContextMenuItem onClick={() => openItem(item, { mode: 'new' })}>
          <ExternalLink />
          新标签页打开
        </ContextMenuItem>
        <ContextMenuItem onClick={() => openItem(item, { mode: 'self' })}>
          <Globe2 />
          当前页面打开
        </ContextMenuItem>

        {(item.url || item.lanUrl) && (
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <Link2 />
              指定网络地址
            </ContextMenuSubTrigger>
            <ContextMenuSubContent sideOffset={6}>
              {item.url && (
                <ContextMenuItem onClick={() => openItem(item, { kind: 'external', mode: 'new' })}>
                  <Globe2 />
                  默认 / 外网地址
                </ContextMenuItem>
              )}
              {item.lanUrl && (
                <ContextMenuItem onClick={() => openItem(item, { kind: 'internal', mode: 'new' })}>
                  <House />
                  内网地址
                </ContextMenuItem>
              )}
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}

        <ContextMenuItem onClick={copyLink}>
          <Copy />
          复制链接
        </ContextMenuItem>

        {isAdmin && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => openEditItem(item.id)}>
              <Pencil />
              编辑卡片
            </ContextMenuItem>
            <ContextMenuItem onClick={() => duplicateItem(item.id)}>
              <CopyPlus />
              创建副本
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => {
                updateItem(item.id, { hidden: !item.hidden })
                toast.success(item.hidden ? '卡片已显示' : '卡片已隐藏（访客不可见）')
              }}
            >
              {item.hidden ? <Eye /> : <EyeOff />}
              {item.hidden ? '对访客显示' : '对访客隐藏'}
            </ContextMenuItem>
            <ContextMenuItem destructive onClick={() => onDeleteRequest?.(item)}>
              <Trash2 />
              删除卡片
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
