import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { GalleryPanel } from '@/components/nav/gallery-panel'
import { useUiStore } from '@/store/ui-store'

export function GalleryDialog() {
  const open = useUiStore((state) => state.galleryOpen)
  const close = useUiStore((state) => state.closeGallery)

  return (
    <Dialog open={open} onOpenChange={(value) => !value && close()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>图标与壁纸库</DialogTitle>
          <DialogDescription>
            管理服务端图库中的图片，支持拖拽批量上传。选择卡片图标或设置壁纸时也可以直接调用图库。
          </DialogDescription>
        </DialogHeader>
        <GalleryPanel />
      </DialogContent>
    </Dialog>
  )
}
