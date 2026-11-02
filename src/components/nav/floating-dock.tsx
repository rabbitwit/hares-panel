import { Check, FolderPlus, Images, PencilLine, Plus, Settings2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAppStore } from '@/store/app-store'
import { useSessionStore } from '@/store/session-store'
import { useUiStore } from '@/store/ui-store'
import { cn } from '@/lib/utils'

function DockButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string
  onClick: () => void
  active?: boolean
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-xl text-foreground/55 transition-all hover:bg-foreground/12 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30',
            active && 'bg-violet-500/20 text-violet-200 hover:bg-violet-500/25 hover:text-violet-100',
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" sideOffset={10}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

export function FloatingDock() {
  const groups = useAppStore((state) => state.groups)
  const session = useSessionStore((state) => state.session)
  const editMode = useUiStore((state) => state.editMode)
  const setEditMode = useUiStore((state) => state.setEditMode)
  const toggleEditMode = useUiStore((state) => state.toggleEditMode)
  const openAddItem = useUiStore((state) => state.openAddItem)
  const openGroupDialog = useUiStore((state) => state.openGroupDialog)
  const openGallery = useUiStore((state) => state.openGallery)
  const openSettings = useUiStore((state) => state.openSettings)

  const user = session
  if (!user) return null

  const sortedGroups = [...groups].sort((a, b) => a.sort - b.sort)

  return (
    <div className="fixed bottom-4 right-3 z-40 sm:bottom-7 sm:right-5">
      <div className="nav-item-surface flex items-center gap-0.5 rounded-2xl border-foreground/10 p-1.5 shadow-2xl backdrop-blur-2xl">
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="添加卡片"
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/25 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
                >
                  <Plus className="h-[18px] w-[18px]" />
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="left" sideOffset={10}>
              添加卡片
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" side="left" className="w-52">
            <DropdownMenuLabel>添加到分组</DropdownMenuLabel>
            {sortedGroups.map((group) => (
              <DropdownMenuItem
                key={group.id}
                onClick={() => {
                  setEditMode(true)
                  openAddItem(group.id)
                }}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-foreground/8 text-[10px] text-foreground/50">
                  {group.name.slice(0, 1)}
                </span>
                <span className="truncate">{group.name}</span>
              </DropdownMenuItem>
            ))}
            {sortedGroups.length === 0 && (
              <div className="px-2 py-3 text-center text-[11px] text-muted-foreground">
                还没有分组
              </div>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                setEditMode(true)
                openGroupDialog()
              }}
            >
              <FolderPlus />
              新建分组
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DockButton
          label="新建分组"
          onClick={() => {
            setEditMode(true)
            openGroupDialog()
          }}
        >
          <FolderPlus className="h-4 w-4" />
        </DockButton>

        <DockButton label={editMode ? '完成编辑' : '编辑模式'} active={editMode} onClick={toggleEditMode}>
          {editMode ? <Check className="h-4 w-4" /> : <PencilLine className="h-4 w-4" />}
        </DockButton>

        <div className="mx-0.5 h-5 w-px bg-foreground/10" />

        <DockButton label="图标与壁纸库" onClick={openGallery}>
          <Images className="h-4 w-4" />
        </DockButton>

        <DockButton label="管理设置" onClick={() => openSettings('site')}>
          <Settings2 className="h-4 w-4" />
        </DockButton>
      </div>
    </div>
  )
}
