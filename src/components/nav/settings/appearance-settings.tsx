import { useRef, useState } from 'react'
import { Check, Images, Loader2, Moon, Sun, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { PanelHeader, SettingsSection, SwitchRow } from './settings-ui'
import { useAppStore } from '@/store/app-store'
import { useUiStore } from '@/store/ui-store'
import { wallpaperPresets } from '@/data/wallpapers'
import { filesToGalleryAssets } from '@/lib/image'
import { cn } from '@/lib/utils'
import type { CardStyle, Wallpaper as WallpaperConfig } from '@/types'

const cardStyles: Array<{ value: CardStyle; label: string; hint: string }> = [
  { value: 'icon', label: '图标模式', hint: '图标在上，名称在下' },
  { value: 'card', label: '卡片模式', hint: '图标 + 标题 + 描述' },
  { value: 'solid', label: '纯色卡片', hint: '按品牌色填充，白色图标' },
  { value: 'transparent', label: '透明悬浮', hint: '轻量无边框卡片' },
]

function StylePreview({ style }: { style: CardStyle }) {
  if (style === 'icon') {
    return (
      <div className="grid w-full grid-cols-3 gap-2">
        {[0, 1, 2].map((index) => (
          <div key={index} className="flex flex-col items-center gap-1">
            <span className="h-6 w-6 rounded-md border border-white/15 bg-white/10" />
            <span className="h-1 w-5 rounded-full bg-white/30" />
          </div>
        ))}
      </div>
    )
  }
  if (style === 'solid') {
    return (
      <div className="w-full space-y-1.5">
        {[0, 1].map((index) => (
          <div
            key={index}
            className={cn(
              'flex items-center gap-1.5 rounded-md border border-white/10 px-1.5 py-1',
              index === 0
                ? 'bg-gradient-to-br from-violet-500/70 to-fuchsia-500/55'
                : 'bg-gradient-to-br from-sky-500/70 to-indigo-500/55',
            )}
          >
            <span className="h-4 w-4 rounded-[5px] border border-white/25 bg-white/20" />
            <span className="block h-1 w-10 rounded-full bg-white/60" />
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="w-full space-y-1.5">
      {[0, 1].map((index) => (
        <div
          key={index}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-1.5 py-1',
            style === 'card' ? 'border border-white/10 bg-white/8' : 'border border-transparent',
          )}
        >
          <span className="h-4 w-4 rounded-[5px] border border-white/10 bg-white/10" />
          <span className="space-y-0.5">
            <span className="block h-1 w-10 rounded-full bg-white/40" />
            <span className="block h-0.5 w-7 rounded-full bg-white/20" />
          </span>
        </div>
      ))}
    </div>
  )
}

export function AppearanceSettingsPanel() {
  const config = useAppStore((state) => state.config)
  const gallery = useAppStore((state) => state.gallery)
  const updateConfig = useAppStore((state) => state.updateConfig)
  const addGalleryAssets = useAppStore((state) => state.addGalleryAssets)
  const openGallery = useUiStore((state) => state.openGallery)
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [wallpaperUrl, setWallpaperUrl] = useState(
    config.wallpaper.type === 'url' ? config.wallpaper.url : '',
  )

  const isLight = config.appearance === 'light'
  const wallpaper = config.wallpaper
  const selectedPresetId = wallpaper.type === 'preset' ? wallpaper.presetId : null
  const galleryAsset =
    wallpaper.type === 'gallery'
      ? gallery.find((asset) => asset.id === wallpaper.assetId) ?? null
      : null

  const uploadWallpaper = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    try {
      const assets = await filesToGalleryAssets([files[0]], 'wallpaper')
      const created = addGalleryAssets(assets)
      if (created[0]) {
        updateConfig({ wallpaper: { type: 'gallery', assetId: created[0].id } })
        toast.success('壁纸已更新并加入图库')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '壁纸上传失败')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const applyWallpaper = (wallpaper: WallpaperConfig) => {
    updateConfig({ wallpaper })
  }

  return (
    <div className="space-y-5">
      <PanelHeader
        title="外观与布局"
        description="调整主题、壁纸、卡片样式和导航页组件。所有改动会立即生效并自动保存。"
      />

      <SettingsSection title="主题模式">
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: 'dark', label: '深色', icon: Moon, hint: '默认，适合深色壁纸' },
            { value: 'light', label: '浅色', icon: Sun, hint: '明亮，适合浅色壁纸' },
          ].map((entry) => {
            const Icon = entry.icon
            return (
              <button
                key={entry.value}
                type="button"
                onClick={() => updateConfig({ appearance: entry.value as 'dark' | 'light' })}
                className={cn(
                  'flex items-center gap-3 rounded-xl border p-3.5 text-left transition-colors',
                  config.appearance === entry.value
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-border/70 hover:bg-muted/40',
                )}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{entry.label}</span>
                  <span className="block text-[10px] text-muted-foreground">{entry.hint}</span>
                </span>
                {config.appearance === entry.value && <Check className="h-4 w-4 text-primary" />}
              </button>
            )
          })}
        </div>
      </SettingsSection>

      <SettingsSection
        title="导航页壁纸"
        description="内置壁纸会随深色/浅色主题自动切换。也可以上传自己的图片。"
        actions={
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={openGallery}>
              <Images className="mr-1.5 h-3.5 w-3.5" />
              图库
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="mr-1.5 h-3.5 w-3.5" />
              )}
              上传壁纸
            </Button>
          </div>
        }
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => void uploadWallpaper(event.target.files)}
        />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {wallpaperPresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyWallpaper({ type: 'preset', presetId: preset.id })}
              className={cn(
                'group relative aspect-[16/9] overflow-hidden rounded-xl border-2 transition-all',
                selectedPresetId === preset.id
                  ? 'border-primary shadow-lg shadow-primary/20'
                  : 'border-transparent hover:border-white/20',
              )}
            >
              <span
                className="absolute inset-0 transition-transform duration-500 group-hover:scale-105"
                style={{ background: isLight ? preset.light : preset.dark }}
              />
              <span className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
              <span className="absolute bottom-2 left-2.5 text-[11px] font-medium text-white drop-shadow">
                {preset.name}
              </span>
              {selectedPresetId === preset.id && (
                <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-white text-black">
                  <Check className="h-3 w-3" />
                </span>
              )}
            </button>
          ))}

          {galleryAsset && (
            <div className="relative aspect-[16/9] overflow-hidden rounded-xl border-2 border-primary">
              <img src={galleryAsset.dataUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <span className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
              <span className="absolute bottom-2 left-2.5 text-[11px] font-medium text-white">
                图库：{galleryAsset.name}
              </span>
              <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-white text-black">
                <Check className="h-3 w-3" />
              </span>
            </div>
          )}

          {config.wallpaper.type === 'url' && config.wallpaper.url && (
            <div className="relative aspect-[16/9] overflow-hidden rounded-xl border-2 border-primary">
              <img src={config.wallpaper.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <span className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
              <span className="absolute bottom-2 left-2.5 text-[11px] font-medium text-white">
                自定义链接
              </span>
            </div>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <Input
            value={wallpaperUrl}
            onChange={(event) => setWallpaperUrl(event.target.value)}
            placeholder="使用网络壁纸：https://..."
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (!wallpaperUrl.trim()) {
                toast.error('请填写壁纸地址')
                return
              }
              applyWallpaper({ type: 'url', url: wallpaperUrl.trim() })
              toast.success('已应用网络壁纸')
            }}
          >
            应用
          </Button>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">壁纸模糊</Label>
              <span className="text-[10px] text-muted-foreground">{config.wallpaperBlur}px</span>
            </div>
            <Slider
              value={[config.wallpaperBlur]}
              min={0}
              max={24}
              step={1}
              onValueChange={([value]) => updateConfig({ wallpaperBlur: value })}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">遮罩浓度</Label>
              <span className="text-[10px] text-muted-foreground">{config.overlayOpacity}%</span>
            </div>
            <Slider
              value={[config.overlayOpacity]}
              min={0}
              max={80}
              step={1}
              onValueChange={([value]) => updateConfig({ overlayOpacity: value })}
            />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="默认卡片样式"
        description="分组可以单独指定样式；没有单独指定时使用这里的设置。"
      >
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {cardStyles.map((style) => (
            <button
              key={style.value}
              type="button"
              onClick={() => updateConfig({ defaultCardStyle: style.value })}
              className={cn(
                'rounded-xl border p-3 text-left transition-colors',
                config.defaultCardStyle === style.value
                  ? 'border-primary/60 bg-primary/5'
                  : 'border-border/70 hover:bg-muted/40',
              )}
            >
              <div className="mb-3 flex h-16 items-center rounded-lg bg-[#0d1024] p-2.5">
                <StylePreview style={style.value} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{style.label}</span>
                {config.defaultCardStyle === style.value && <Check className="h-3.5 w-3.5 text-primary" />}
              </div>
              <span className="mt-0.5 block text-[10px] text-muted-foreground">{style.hint}</span>
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">卡片圆角</Label>
              <span className="text-[10px] text-muted-foreground">{config.cardRadius}px</span>
            </div>
            <Slider
              value={[config.cardRadius]}
              min={6}
              max={28}
              step={1}
              onValueChange={([value]) => updateConfig({ cardRadius: value })}
            />
          </div>
          <SwitchRow
            label="悬浮光效"
            hint="鼠标悬停卡片时显示柔光"
            checked={config.glowEffect}
            onCheckedChange={(value) => updateConfig({ glowEffect: value })}
          />
        </div>
      </SettingsSection>

      <SettingsSection title="顶部品牌与时钟">
        <SwitchRow
          label="显示站点 Logo 和名称"
          checked={config.showLogo}
          onCheckedChange={(value) => updateConfig({ showLogo: value })}
        />
        <SwitchRow
          label="显示时钟"
          checked={config.showClock}
          onCheckedChange={(value) => updateConfig({ showClock: value })}
        />
        <SwitchRow
          label="显示秒数"
          checked={config.showSeconds}
          onCheckedChange={(value) => updateConfig({ showSeconds: value })}
        />
        <SwitchRow
          label="显示日期和星期"
          checked={config.showDate}
          onCheckedChange={(value) => updateConfig({ showDate: value })}
        />
        <SwitchRow
          label="24 小时制"
          checked={config.use24Hour}
          onCheckedChange={(value) => updateConfig({ use24Hour: value })}
        />
      </SettingsSection>

      <SettingsSection title="设备状态">
        <SwitchRow
          label="显示设备状态"
          hint="展示浏览器可读取的本机 CPU、内存、存储和网络信息。"
          checked={config.showSystemStatus}
          onCheckedChange={(value) => updateConfig({ showSystemStatus: value })}
        />
        {config.showSystemStatus && (
          <div className="space-y-2 pt-2">
            <Label htmlFor="system-title">状态区标题</Label>
            <Input
              id="system-title"
              value={config.systemStatusTitle}
              onChange={(event) => updateConfig({ systemStatusTitle: event.target.value })}
              maxLength={30}
            />
          </div>
        )}
      </SettingsSection>
    </div>
  )
}
