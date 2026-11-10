import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '@iconify/react'
import { Check, ImagePlus, Link2, Loader2, Search, Sparkles, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NavIcon } from '@/components/nav/nav-icon'
import { ColorField } from '@/components/nav/color-field'
import { useAppStore } from '@/store/app-store'
import {
  collectionLabel,
  searchBundledIcons,
  searchRemoteIcons,
  type PickerIcon,
} from '@/lib/iconify'
import { filesToGalleryAssets } from '@/lib/image'
import { brandColorForIcon } from '@/lib/brand-color'
import { cn, colorFromString, colorWithAlpha, formatBytes, readableTextColor } from '@/lib/utils'

interface IconPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: string
  color: string
  title: string
  onSelect: (icon: string, color: string) => void
}

type TabKey = 'library' | 'gallery' | 'url'

export function IconPicker({
  open,
  onOpenChange,
  value,
  color,
  title,
  onSelect,
}: IconPickerProps) {
  const gallery = useAppStore((state) => state.gallery)
  const addGalleryAssets = useAppStore((state) => state.addGalleryAssets)
  const [tab, setTab] = useState<TabKey>('library')
  const [query, setQuery] = useState('')
  const [collection, setCollection] = useState<'all' | 'logos' | 'simple-icons'>('all')
  const [draft, setDraft] = useState(value)
  const [draftColor, setDraftColor] = useState(color)
  const [urlValue, setUrlValue] = useState('')
  const [remoteIcons, setRemoteIcons] = useState<PickerIcon[]>([])
  const [remoteLoading, setRemoteLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setDraft(value)
    setDraftColor(color)
    setUrlValue(/^https?:\/\//.test(value) || value.startsWith('data:') ? value : '')
    setTab('library')
    setQuery('')
  }, [color, open, value])

  const localIcons = useMemo(() => {
    const results = searchBundledIcons(query, 240)
    return collection === 'all' ? results : results.filter((entry) => entry.collection === collection)
  }, [collection, query])

  useEffect(() => {
    if (!open) return
    const normalized = query.trim()
    if (normalized.length < 2) {
      setRemoteIcons([])
      setRemoteLoading(false)
      return
    }
    const timer = window.setTimeout(async () => {
      setRemoteLoading(true)
      const results = await searchRemoteIcons(normalized, 60)
      setRemoteIcons(results)
      setRemoteLoading(false)
    }, 550)
    return () => window.clearTimeout(timer)
  }, [open, query])

  const iconAssets = gallery.filter((asset) => asset.category === 'icon')

  // The preview mirrors a solid card, so it needs the same accent resolution
  // the card uses: explicit colour, then the icon's own brand colour.
  const previewAccent = draftColor || brandColorForIcon(draft) || colorFromString(title || draft || '图标')

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    try {
      const assets = await filesToGalleryAssets(Array.from(files), 'icon')
      const created = addGalleryAssets(assets)
      if (created[0]) {
        const asset = created[0]
        setDraft(`gallery:${asset.id}`)
        setDraftColor('')
        setTab('gallery')
        toast.success('图片已上传并加入图库')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '上传失败')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const choose = (icon: string) => {
    setDraft(icon)
    if (icon.startsWith('logos:')) setDraftColor('')
  }

  const apply = () => {
    if (!draft.trim()) {
      toast.error('请选择一个图标，或上传图片')
      return
    }
    onSelect(draft.trim(), draftColor)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="z-[95] flex h-[min(720px,88dvh)] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <div className="border-b border-border/70 p-5 pb-4">
          <DialogHeader>
            <DialogTitle>选择图标</DialogTitle>
            <DialogDescription>支持 Iconify 图标、图片链接、上传图片和从图库选择。</DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center gap-2 border-b border-border/70 px-4 py-2.5">
              {(
                [
                  { key: 'library', label: '图标库', icon: Sparkles },
                  { key: 'gallery', label: '我的图库', icon: ImagePlus },
                  { key: 'url', label: '图片链接', icon: Link2 },
                ] as const
              ).map((entry) => {
                const IconComponent = entry.icon
                return (
                  <button
                    key={entry.key}
                    type="button"
                    onClick={() => setTab(entry.key)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                      tab === entry.key && 'bg-accent text-foreground',
                    )}
                  >
                    <IconComponent className="h-3.5 w-3.5" />
                    {entry.label}
                  </button>
                )
              })}
            </div>

            {tab === 'library' && (
              <>
                <div className="space-y-2.5 border-b border-border/70 px-4 py-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="搜索图标，例如 google、docker、home..."
                      className="h-9 pl-9 pr-8 text-[13px]"
                    />
                    {query && (
                      <button
                        type="button"
                        onClick={() => setQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {(['all', 'logos', 'simple-icons'] as const).map((entry) => (
                      <button
                        key={entry}
                        type="button"
                        onClick={() => setCollection(entry)}
                        className={cn(
                          'rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-accent',
                          collection === entry && 'bg-primary/10 text-primary',
                        )}
                      >
                        {entry === 'all' ? '全部' : collectionLabel(entry)}
                      </button>
                    ))}
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {localIcons.length} 个离线图标
                    </span>
                  </div>
                </div>

                <div className="styled-scrollbar min-h-0 flex-1 overflow-y-auto p-3">
                  {localIcons.length > 0 && (
                    <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 md:grid-cols-10">
                      {localIcons.map((entry) => (
                        <button
                          key={entry.name}
                          type="button"
                          title={entry.name}
                          onClick={() => choose(entry.name)}
                          className={cn(
                            'flex aspect-square items-center justify-center rounded-lg border border-transparent text-foreground/80 transition-all hover:bg-accent hover:text-foreground',
                            draft === entry.name && 'border-primary/40 bg-primary/10',
                          )}
                        >
                          <Icon icon={entry.name} width={22} height={22} />
                        </button>
                      ))}
                    </div>
                  )}

                  {query.trim().length >= 2 && (
                    <div className="mt-3 border-t border-border/60 pt-3">
                      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        Iconify 在线搜索
                        {remoteLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                      </div>
                      {remoteIcons.length > 0 ? (
                        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 md:grid-cols-10">
                          {remoteIcons.map((entry) => (
                            <button
                              key={entry.name}
                              type="button"
                              title={entry.name}
                              onClick={() => choose(entry.name)}
                              className={cn(
                                'flex aspect-square items-center justify-center rounded-lg border border-transparent text-foreground/80 transition-all hover:bg-accent hover:text-foreground',
                                draft === entry.name && 'border-primary/40 bg-primary/10',
                              )}
                            >
                              <Icon icon={entry.name} width={22} height={22} />
                            </button>
                          ))}
                        </div>
                      ) : (
                        !remoteLoading && (
                          <p className="text-[11px] text-muted-foreground">
                            {navigator.onLine
                              ? '没有更多在线结果，试试更简短的关键词。'
                              : '当前离线，仅显示内置图标。'}
                          </p>
                        )
                      )}
                    </div>
                  )}

                  {localIcons.length === 0 && remoteIcons.length === 0 && !remoteLoading && (
                    <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
                      <Search className="h-6 w-6 opacity-40" />
                      <p className="text-xs">没有找到图标</p>
                    </div>
                  )}
                </div>
              </>
            )}

            {tab === 'gallery' && (
              <div className="styled-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[11px] text-muted-foreground">上传的图标会保存到服务端图库</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                    上传
                  </Button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(event) => void handleUpload(event.target.files)}
                />
                {iconAssets.length > 0 ? (
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {iconAssets.map((asset) => (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => {
                          setDraft(`gallery:${asset.id}`)
                          setDraftColor('')
                        }}
                        className={cn(
                          'group relative aspect-square overflow-hidden rounded-xl border border-border/60 bg-muted/40 p-2 transition-all hover:border-primary/40',
                          draft === `gallery:${asset.id}` && 'border-primary ring-2 ring-primary/20',
                        )}
                        title={asset.name}
                      >
                        <img
                          src={asset.dataUrl}
                          alt={asset.name}
                          className="h-full w-full object-contain"
                        />
                        <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1.5 py-1 text-left text-[9px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                          {asset.name}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-44 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  >
                    <ImagePlus className="h-6 w-6" />
                    <span className="text-xs">上传第一张图标</span>
                  </button>
                )}
              </div>
            )}

            {tab === 'url' && (
              <div className="space-y-4 p-5">
                <div className="space-y-2">
                  <Label htmlFor="icon-url">图片地址</Label>
                  <Input
                    id="icon-url"
                    value={urlValue}
                    onChange={(event) => setUrlValue(event.target.value)}
                    placeholder="https://example.com/icon.png"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    支持 PNG、JPG、SVG、WebP，也可以使用 Data URL。
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    if (!urlValue.trim()) {
                      toast.error('请填写图片地址')
                      return
                    }
                    setDraft(urlValue.trim())
                    setDraftColor('')
                  }}
                >
                  使用这个地址
                </Button>
              </div>
            )}
          </div>

          <aside className="w-full shrink-0 border-t border-border/70 bg-muted/25 p-5 sm:w-[240px] sm:border-l sm:border-t-0">
            <div className="text-xs font-medium text-muted-foreground">预览</div>
            <div
              className="mt-3 flex flex-col items-center gap-3 rounded-2xl border border-white/20 p-5 shadow-inner"
              style={{ background: `linear-gradient(135deg, ${colorWithAlpha(previewAccent, 0.96)}, ${colorWithAlpha(previewAccent, 0.76)})`, color: readableTextColor(previewAccent) }}
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-[18px] bg-white/15">
                <NavIcon icon={draft} iconColor={draftColor} title={title || '图标'} size={34} silhouette />
              </div>
              <div className="max-w-full truncate text-xs opacity-95">{title || '卡片标题'}</div>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
              按纯色卡片样式预览，实际效果随卡片样式变化。
            </p>

            <div className="mt-5 space-y-2">
              <Label className="text-xs">图标颜色</Label>
              <ColorField value={draftColor} onChange={setDraftColor} />
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                仅对单色图标生效。品牌彩色 Logo 会自动保留原色；纯色卡片模式下这个颜色就是卡片底色。
              </p>
            </div>

            <div className="mt-5 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
              <div className="truncate text-[10px] text-muted-foreground">{draft || '尚未选择图标'}</div>
              {draft.startsWith('gallery:') && (
                <div className="mt-0.5 text-[9px] text-muted-foreground/70">
                  {formatBytes(gallery.find((asset) => asset.id === draft.slice(8))?.size ?? 0)}
                </div>
              )}
            </div>
          </aside>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border/70 p-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setDraft('')
              setDraftColor('')
            }}
          >
            清除图标
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="button" onClick={apply}>
              <Check className="mr-1.5 h-4 w-4" />
              使用这个图标
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
