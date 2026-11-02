import { useRef, useState } from 'react'
import { Copy, Download, ImageIcon, Loader2, MoreHorizontal, Trash2, Upload, Wallpaper } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { useCloudStore } from '@/store/cloud-store'
import { filesToGalleryAssets } from '@/lib/image'
import { CloudApiError, deleteCloudAsset } from '@/lib/cloud'
import { cn, copyText, downloadDataUrl, formatBytes } from '@/lib/utils'
import type { GalleryAsset, WallpaperCategory } from '@/types'

export function GalleryPanel({ embedded = false }: { embedded?: boolean }) {
  const gallery = useAppStore((state) => state.gallery)
  const addGalleryAssets = useAppStore((state) => state.addGalleryAssets)
  const removeGalleryAsset = useAppStore((state) => state.removeGalleryAsset)
  const updateConfig = useAppStore((state) => state.updateConfig)
  const cloudAssets = useCloudStore(
    (state) => state.status === 'connected' && Boolean(state.info?.assets),
  )
  const [category, setCategory] = useState<WallpaperCategory>('icon')
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<GalleryAsset | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const assets = gallery.filter((asset) => asset.category === category)
  const totalSize = gallery.reduce((sum, asset) => sum + asset.size, 0)

  const upload = async (files: FileList | File[] | null) => {
    if (!files || (files as FileList).length === 0) return
    if (!cloudAssets) {
      toast.error('服务端未配置对象存储（R2 / Vercel Blob / EdgeOne Blob / Docker 本地目录），无法上传图片')
      return
    }
    setUploading(true)
    try {
      const created = await filesToGalleryAssets(Array.from(files as FileList), category)
      addGalleryAssets(created)
      toast.success(`已上传 ${created.length} 张${category === 'icon' ? '图标' : '壁纸'}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '上传失败')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const removeAsset = async () => {
    const asset = pendingDelete
    if (!asset) return
    const cloud = useCloudStore.getState()
    if (asset.remoteKey) {
      if (!cloud.token) {
        toast.error('登录状态已失效，请重新登录后再删除')
        return
      }
      try {
        await deleteCloudAsset(cloud.token, asset.remoteKey, asset.dataUrl)
      } catch (error) {
        // A 404 means the object is already gone; remove the stale metadata.
        if (!(error instanceof CloudApiError && error.status === 404)) {
          toast.error(
            error instanceof CloudApiError
              ? `对象存储删除失败：${error.message}`
              : '对象存储删除失败，请检查网络后重试',
          )
          return
        }
      }
    }
    removeGalleryAsset(asset.id)
    setPendingDelete(null)
    toast.success('图片已从图库和对象存储删除')
  }

  return (
    <div className={cn('flex flex-col gap-4', !embedded && 'min-h-0')}>
      {!cloudAssets && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-2.5 text-[11px] leading-relaxed text-amber-700 dark:text-amber-200">
          服务端尚未配置对象存储（R2 / Vercel Blob / EdgeOne Blob / Docker 本地目录），图库上传不可用。配置后重新部署即可启用。
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={category} onValueChange={(value) => setCategory(value as WallpaperCategory)}>
          <TabsList className="h-9">
            <TabsTrigger value="icon" className="gap-1.5 text-xs">
              <ImageIcon className="h-3.5 w-3.5" />
              图标 {gallery.filter((asset) => asset.category === 'icon').length}
            </TabsTrigger>
            <TabsTrigger value="wallpaper" className="gap-1.5 text-xs">
              <Wallpaper className="h-3.5 w-3.5" />
              壁纸 {gallery.filter((asset) => asset.category === 'wallpaper').length}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <span className="hidden text-[11px] text-muted-foreground sm:inline">
            共 {formatBytes(totalSize)}
          </span>
          <Button
            type="button"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading || !cloudAssets}
          >
            {uploading ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="mr-1.5 h-3.5 w-3.5" />
            )}
            上传{category === 'icon' ? '图标' : '壁纸'}
          </Button>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => void upload(event.target.files)}
      />

      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          void upload(event.dataTransfer.files)
        }}
        className={cn(
          'styled-scrollbar min-h-[260px] overflow-y-auto rounded-xl border border-dashed border-transparent p-1 transition-colors',
          dragging && 'border-primary/40 bg-primary/5',
          !embedded && 'max-h-[55vh]',
        )}
      >
        {assets.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {assets.map((asset) => (
              <div
                key={asset.id}
                className="group overflow-hidden rounded-xl border border-border/70 bg-muted/25"
              >
                <div
                  className={cn(
                    'relative flex items-center justify-center overflow-hidden bg-[linear-gradient(45deg,rgba(255,255,255,.035)_25%,transparent_25%,transparent_75%,rgba(255,255,255,.035)_75%),linear-gradient(45deg,rgba(255,255,255,.035)_25%,transparent_25%,transparent_75%,rgba(255,255,255,.035)_75%)] bg-[length:14px_14px] bg-[position:0_0,7px_7px]',
                    asset.category === 'icon' ? 'aspect-square p-6' : 'aspect-video',
                  )}
                >
                  <img
                    src={asset.dataUrl}
                    alt={asset.name}
                    className={cn(
                      'h-full w-full',
                      asset.category === 'icon' ? 'object-contain' : 'object-cover',
                    )}
                  />
                  {asset.remoteKey && (
                    <span className="absolute left-2 top-2 rounded-full border border-white/20 bg-black/45 px-1.5 py-0.5 text-[8px] text-white/85 backdrop-blur">
                      远程
                    </span>
                  )}
                  <div className="absolute right-2 top-2 flex items-center gap-1">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="glass"
                      className="h-7 w-7 text-red-200 hover:bg-red-500/30 hover:text-white"
                      onClick={() => setPendingDelete(asset)}
                      title="删除图片"
                      aria-label={`删除图片 ${asset.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon-sm"
                          variant="glass"
                          className="h-7 w-7"
                          title="更多图片操作"
                          aria-label="更多图片操作"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        {asset.category === 'wallpaper' && (
                          <DropdownMenuItem
                            onClick={() => {
                              updateConfig({
                                wallpaper: { type: 'gallery', assetId: asset.id },
                              })
                              toast.success('已设为导航页壁纸')
                            }}
                          >
                            <Wallpaper />
                            设为壁纸
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => {
                            void downloadDataUrl(asset.name, asset.dataUrl)
                          }}
                        >
                          <Download />
                          下载图片
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={async () => {
                            const ok = await copyText(asset.dataUrl)
                            if (ok) {
                              toast.success(
                                asset.remoteKey ? '图片地址已复制' : '图片 Data URL 已复制',
                              )
                            }
                          }}
                        >
                          <Copy />
                          {asset.remoteKey ? '复制图片地址' : '复制 Data URL'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem destructive onClick={() => setPendingDelete(asset)}>
                          <Trash2 />
                          删除图片
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <div className="px-2.5 py-2">
                  <div className="truncate text-[11px] font-medium">{asset.name}</div>
                  <div className="mt-0.5 flex items-center justify-between text-[9px] text-muted-foreground">
                    <span>{formatBytes(asset.size)}</span>
                    <span>{new Date(asset.createdAt).toLocaleDateString('zh-CN')}</span>
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <Upload className="h-5 w-5" />
              <span className="text-[11px]">继续上传</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-[260px] w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/20 hover:text-foreground"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
              {category === 'icon' ? <ImageIcon className="h-6 w-6" /> : <Wallpaper className="h-6 w-6" />}
            </span>
            <span className="text-sm font-medium">
              上传你的第一张{category === 'icon' ? '图标' : '壁纸'}
            </span>
            <span className="text-[11px]">
              {cloudAssets
                ? '把图片拖到这里，压缩后会直接上传到 R2 / Vercel Blob / EdgeOne Blob / Docker 本地目录'
                : '配置对象存储后即可上传图片'}
            </span>
          </button>
        )}
      </div>

      <p className="text-[10px] leading-relaxed text-muted-foreground">
        图片保存在服务端对象存储（R2 / Vercel Blob / EdgeOne Blob / Docker 本地目录），元数据随导航数据保存。删除正在使用的图片时，引用它的卡片或壁纸会自动回退。
      </p>

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(value) => !value && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这张图片？</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingDelete?.name}”将从服务端图库与对象存储中删除。已使用该图片作为图标或壁纸的位置会自动回退。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void removeAsset()}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
