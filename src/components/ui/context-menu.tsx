import * as React from 'react'
import * as ContextMenuPrimitive from '@radix-ui/react-context-menu'
import { Check, ChevronRight, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

const ContextMenu = ContextMenuPrimitive.Root
const ContextMenuTrigger = ContextMenuPrimitive.Trigger
const ContextMenuGroup = ContextMenuPrimitive.Group
const ContextMenuPortal = ContextMenuPrimitive.Portal
const ContextMenuSub = ContextMenuPrimitive.Sub
const ContextMenuRadioGroup = ContextMenuPrimitive.RadioGroup

const ContextMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubTrigger> & { inset?: boolean }
>(({ className, inset, children, ...props }, ref) => (
  <ContextMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      'flex cursor-default select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none focus:bg-white/10 data-[state=open]:bg-white/10 [&_svg]:size-4',
      inset && 'pl-8',
      className,
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto" />
  </ContextMenuPrimitive.SubTrigger>
))
ContextMenuSubTrigger.displayName = ContextMenuPrimitive.SubTrigger.displayName

const ContextMenuSubContent = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => {
  const revealRef = useContextMenuReveal(isSubmenuPositioned)
  const setRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      revealRef(node)
      if (typeof ref === 'function') ref(node)
      else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
    },
    [ref, revealRef],
  )

  return (
    <ContextMenuPrimitive.SubContent
      ref={setRef}
      className={cn(
        'context-menu-sub z-[110] min-w-[9rem] rounded-xl border border-white/10 bg-[#0d1228] p-1.5 text-white shadow-2xl',
        className,
      )}
      {...props}
    />
  )
})
ContextMenuSubContent.displayName = ContextMenuPrimitive.SubContent.displayName

interface ContextPoint {
  x: number
  y: number
  keyboard: boolean
}

let contextPoint: ContextPoint | null = null

if (typeof window !== 'undefined') {
  // Capture phase runs before Radix opens the menu.
  window.addEventListener(
    'contextmenu',
    (event) => {
      contextPoint = {
        x: event.clientX,
        y: event.clientY,
        keyboard: event.clientX === 0 && event.clientY === 0,
      }
    },
    true,
  )
}

function isRootPositioned(node: HTMLDivElement) {
  const rect = node.getBoundingClientRect()
  const positioned =
    rect.width > 0 && (Math.abs(rect.left) > 1 || Math.abs(rect.top) > 1)
  if (!contextPoint || contextPoint.keyboard) return positioned
  return (
    positioned &&
    contextPoint.x >= rect.left - 16 &&
    contextPoint.x <= rect.right + 16 &&
    contextPoint.y >= rect.top - 16 &&
    contextPoint.y <= rect.bottom + 16
  )
}

function isSubmenuPositioned(node: HTMLDivElement) {
  const trigger =
    document.querySelector<HTMLElement>(
      '[role="menuitem"][data-state="open"][aria-haspopup="menu"]',
    ) ??
    document.querySelector<HTMLElement>(
      '[role="menuitem"][data-state="open"][aria-expanded="true"]',
    )
  if (!trigger) return false

  const rect = node.getBoundingClientRect()
  const triggerRect = trigger.getBoundingClientRect()
  const horizontal =
    Math.abs(rect.left - triggerRect.right) <= 24 ||
    Math.abs(triggerRect.left - rect.right) <= 24
  const vertical =
    rect.top < triggerRect.bottom + 24 && rect.bottom > triggerRect.top - 24
  return rect.width > 0 && horizontal && vertical
}

function useContextMenuReveal(isPositioned: (node: HTMLDivElement) => boolean) {
  const cleanupRef = React.useRef<(() => void) | null>(null)
  React.useEffect(() => () => cleanupRef.current?.(), [])

  return React.useCallback(
    (node: HTMLDivElement | null) => {
      cleanupRef.current?.()
      cleanupRef.current = null
      if (!node) return

      node.style.visibility = 'hidden'
      let frame = 0
      let raf = 0

      const reveal = () => {
        if (isPositioned(node) || frame >= 60) {
          node.style.visibility = 'visible'
          return
        }
        frame += 1
        raf = requestAnimationFrame(reveal)
      }

      raf = requestAnimationFrame(reveal)
      cleanupRef.current = () => cancelAnimationFrame(raf)
    },
    [isPositioned],
  )
}

const ContextMenuContent = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>
>(({ className, ...props }, ref) => {
  const revealRef = useContextMenuReveal(isRootPositioned)
  const setRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      revealRef(node)
      if (typeof ref === 'function') ref(node)
      else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
    },
    [ref, revealRef],
  )

  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        ref={setRef}
        className={cn(
          'context-menu-content z-[110] min-w-[11rem] rounded-xl border border-white/10 bg-[#0d1228] p-1.5 text-white shadow-2xl',
          className,
        )}
        {...props}
      />
    </ContextMenuPrimitive.Portal>
  )
})
ContextMenuContent.displayName = ContextMenuPrimitive.Content.displayName

const ContextMenuItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item> & {
    inset?: boolean
    destructive?: boolean
  }
>(({ className, inset, destructive, ...props }, ref) => (
  <ContextMenuPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none transition-colors focus:bg-white/10 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
      inset && 'pl-8',
      destructive && 'text-red-300 focus:bg-red-500/15 focus:text-red-200',
      className,
    )}
    {...props}
  />
))
ContextMenuItem.displayName = ContextMenuPrimitive.Item.displayName

const ContextMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <ContextMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center rounded-md py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-white/10 data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className,
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <ContextMenuPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </ContextMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </ContextMenuPrimitive.CheckboxItem>
))
ContextMenuCheckboxItem.displayName = ContextMenuPrimitive.CheckboxItem.displayName

const ContextMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <ContextMenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center rounded-md py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-white/10 data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <ContextMenuPrimitive.ItemIndicator>
        <Circle className="h-2 w-2 fill-current" />
      </ContextMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </ContextMenuPrimitive.RadioItem>
))
ContextMenuRadioItem.displayName = ContextMenuPrimitive.RadioItem.displayName

const ContextMenuLabel = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Label> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => (
  <ContextMenuPrimitive.Label
    ref={ref}
    className={cn('px-2 py-1.5 text-[11px] font-medium text-white/45', inset && 'pl-8', className)}
    {...props}
  />
))
ContextMenuLabel.displayName = ContextMenuPrimitive.Label.displayName

const ContextMenuSeparator = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-white/10', className)}
    {...props}
  />
))
ContextMenuSeparator.displayName = ContextMenuPrimitive.Separator.displayName

function ContextMenuShortcut({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('ml-auto text-[10px] tracking-widest text-white/40', className)} {...props} />
}

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuPortal,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuRadioGroup,
}
