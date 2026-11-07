import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, CornerDownLeft, Search, Settings2 } from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { useSessionStore } from '@/store/session-store'
import { useUiStore } from '@/store/ui-store'
import { useOpenItem } from '@/hooks/use-open-item'
import { buildSearchUrl } from '@/lib/network'
import { NavIcon } from '@/components/nav/nav-icon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export function SearchBar() {
  const config = useAppStore((state) => state.config)
  const engines = useAppStore((state) => state.searchEngines)
  const updateConfig = useAppStore((state) => state.updateConfig)
  const groups = useAppStore((state) => state.groups)
  const items = useAppStore((state) => state.items)
  const session = useSessionStore((state) => state.session)
  const openSettings = useUiStore((state) => state.openSettings)
  const { openItem } = useOpenItem()
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [engineId, setEngineId] = useState(config.defaultEngineId)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const sortedEngines = useMemo(
    () => [...engines].sort((a, b) => a.sort - b.sort),
    [engines],
  )
  const engine = sortedEngines.find((entry) => entry.id === engineId) ?? sortedEngines[0]
  const isAdmin = Boolean(session)

  useEffect(() => {
    if (!sortedEngines.some((entry) => entry.id === engineId)) {
      setEngineId(config.defaultEngineId || sortedEngines[0]?.id || '')
    }
  }, [config.defaultEngineId, engineId, sortedEngines])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTyping =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      if (event.key === '/' && !isTyping && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setFocused(false)
      }
    }
    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  const matches = useMemo(() => {
    const value = query.trim().toLowerCase()
    if (!value) return []
    return items
      .filter((item) => {
        const group = groups.find((entry) => entry.id === item.groupId)
        if (!isAdmin && (item.hidden || group?.hidden)) return false
        return `${item.title} ${item.description} ${item.url} ${group?.name ?? ''}`
          .toLowerCase()
          .includes(value)
      })
      .slice(0, 6)
  }, [groups, isAdmin, items, query])

  const submit = () => {
    if (!engine) return
    const url = buildSearchUrl(engine.url, query)
    if (!url) return
    if (config.searchInNewTab) {
      window.open(url, '_blank', 'noopener,noreferrer')
    } else {
      window.location.assign(url)
    }
  }

  const chooseEngine = (id: string) => {
    setEngineId(id)
    updateConfig({ defaultEngineId: id })
  }

  const showMatches = focused && query.trim().length > 0 && matches.length > 0

  return (
    <div ref={containerRef} className="relative z-30 w-full">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
        className="relative"
      >
        <div className="nav-search flex h-[52px] items-center rounded-[18px] px-2 sm:h-[56px] sm:rounded-full sm:px-2.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="ml-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25"
                aria-label="选择搜索引擎"
              >
                {engine ? (
                  <NavIcon
                    icon={engine.icon}
                    iconColor={engine.iconColor}
                    title={engine.name}
                    size={22}
                  />
                ) : (
                  <Search className="h-5 w-5 text-foreground/60" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60">
              <DropdownMenuLabel>搜索引擎</DropdownMenuLabel>
              {sortedEngines.map((entry) => (
                <DropdownMenuItem
                  key={entry.id}
                  onClick={() => chooseEngine(entry.id)}
                  className="gap-3 py-2"
                >
                  <NavIcon icon={entry.icon} iconColor={entry.iconColor} title={entry.name} size={18} />
                  <span className="flex-1">{entry.name}</span>
                  {engine?.id === entry.id && <Check className="h-4 w-4 text-primary" />}
                </DropdownMenuItem>
              ))}
              {isAdmin && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => openSettings('search')}>
                    <Settings2 />
                    搜索引擎设置
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <input
            id="nav-search-input"
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setFocused(true)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setFocused(false)
                inputRef.current?.blur()
              }
            }}
            placeholder={config.searchPlaceholder}
            autoComplete="off"
            spellCheck={false}
            className="h-full min-w-0 flex-1 bg-transparent px-3 text-[15px] font-medium text-foreground outline-none placeholder:font-normal placeholder:text-foreground/40"
            aria-label="搜索"
          />

          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                inputRef.current?.focus()
              }}
              className="mr-1 hidden rounded-full px-2 py-1 text-[11px] text-foreground/40 transition-colors hover:text-foreground/70 sm:block"
            >
              清除
            </button>
          )}

          <span className="mr-2 hidden items-center gap-1 rounded-md border border-foreground/10 bg-foreground/5 px-1.5 py-1 text-[10px] font-medium text-foreground/40 sm:flex">
            <CornerDownLeft className="h-3 w-3" />
            Enter
          </span>

          <button
            type="submit"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-foreground/85 transition-all hover:bg-foreground/20 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
            aria-label="搜索"
          >
            <Search className="h-[18px] w-[18px]" />
          </button>
        </div>
      </form>

      {showMatches && (
        <div className="nav-menu-surface absolute left-0 right-0 top-[calc(100%+10px)] overflow-hidden rounded-2xl p-1.5">
          <div className="px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wider text-foreground/40">
            站内快速访问
          </div>
          {matches.map((item) => {
            const group = groups.find((entry) => entry.id === item.groupId)
            return (
              <button
                key={item.id}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setFocused(false)
                  openItem(item)
                }}
                className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-foreground/10"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground/8">
                  <NavIcon icon={item.icon} iconColor={item.iconColor} title={item.title} size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-foreground">{item.title}</span>
                  <span className="block truncate text-[11px] text-foreground/40">
                    {group?.name ?? '未分组'}
                    {item.description ? ` · ${item.description}` : ''}
                  </span>
                </span>
                <CornerDownLeft className="h-3.5 w-3.5 text-foreground/25" />
              </button>
            )
          })}
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setFocused(false)
              submit()
            }}
            className={cn(
              'mt-1 flex w-full items-center gap-2 rounded-xl border-t border-foreground/5 px-2.5 py-2.5 text-left text-[12px] text-foreground/55 transition-colors hover:bg-foreground/5 hover:text-foreground/80',
            )}
          >
            <Search className="h-3.5 w-3.5" />
            使用 {engine?.name ?? '搜索引擎'} 搜索“{query.trim()}”
          </button>
        </div>
      )}
    </div>
  )
}
