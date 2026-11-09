import { GalleryPanel } from '@/components/nav/gallery-panel'
import { PanelHeader } from './settings-ui'

export function MediaSettingsPanel() {
  return (
    <div className="space-y-5">
      <PanelHeader
        title="图标与壁纸库"
        description="上传的图片会压缩后保存到服务端对象存储（R2 / KV / Vercel Blob / EdgeOne Blob / Docker 本地目录），元数据随导航数据保存。可以在这里直接设为壁纸，或在卡片图标选择器中使用。"
      />
      <div className="rounded-2xl border border-border/70 bg-card/40 p-4 sm:p-5">
        <GalleryPanel embedded />
      </div>
    </div>
  )
}
