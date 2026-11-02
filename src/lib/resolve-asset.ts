import type { GalleryAsset } from '@/types'

export function resolveAssetLike(value: string | undefined, gallery: GalleryAsset[]) {
  if (!value) return ''
  if (value.startsWith('gallery:')) {
    return gallery.find((asset) => asset.id === value.slice('gallery:'.length))?.dataUrl ?? ''
  }
  return value
}
