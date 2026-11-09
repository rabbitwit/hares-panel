import { formatBytes } from '@/lib/utils'
import { dataUrlToBlob, deleteCloudAsset, uploadCloudAsset } from '@/lib/cloud'
import { useCloudStore } from '@/store/cloud-store'
import type { GalleryAsset, WallpaperCategory } from '@/types'

const MAX_SOURCE_SIZE = 20 * 1024 * 1024
const ICON_MAX = 512
const WALLPAPER_MAX = 2560

export interface ProcessedImage {
  dataUrl: string
  width: number
  height: number
  size: number
  mime: string
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function loadImageElement(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片加载失败'))
    image.src = source
  })
}

export async function processImage(file: File, category: WallpaperCategory): Promise<ProcessedImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error('请选择图片文件')
  }
  if (file.size > MAX_SOURCE_SIZE) {
    throw new Error(`图片不能超过 ${formatBytes(MAX_SOURCE_SIZE, 0)}`)
  }

  const original = await readFile(file)

  if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return {
      dataUrl: original,
      width: 0,
      height: 0,
      size: file.size,
      mime: file.type,
    }
  }

  const element = await loadImageElement(original)
  const max = category === 'icon' ? ICON_MAX : WALLPAPER_MAX
  const scale = Math.min(1, max / Math.max(element.naturalWidth, element.naturalHeight))
  const width = Math.max(1, Math.round(element.naturalWidth * scale))
  const height = Math.max(1, Math.round(element.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前浏览器不支持图片处理')
  context.imageSmoothingQuality = 'high'
  context.drawImage(element, 0, 0, width, height)

  const webp = canvas.toDataURL('image/webp', category === 'icon' ? 0.9 : 0.86)
  const mime = webp.startsWith('data:image/webp') ? 'image/webp' : 'image/png'
  const dataUrl = mime === 'image/webp' ? webp : canvas.toDataURL('image/png')

  return {
    dataUrl,
    width,
    height,
    size: dataUrlSize(dataUrl),
    mime,
  }
}

export function dataUrlSize(dataUrl: string) {
  const commaIndex = dataUrl.indexOf(',')
  if (commaIndex === -1) return dataUrl.length
  const base64 = dataUrl.slice(commaIndex + 1)
  const padding = (base64.match(/=+$/) ?? [''])[0].length
  return Math.floor((base64.length * 3) / 4) - padding
}

export async function filesToGalleryAssets(
  files: File[],
  category: WallpaperCategory,
): Promise<Omit<GalleryAsset, 'id' | 'createdAt'>[]> {
  const cloud = useCloudStore.getState()
  if (cloud.status !== 'connected' || !cloud.info?.assets || !cloud.token) {
    throw new Error('图库需要已连接的服务端与对象存储（R2 / KV / Vercel Blob / EdgeOne Blob / Docker 本地目录）')
  }
  const token = cloud.token
  const assets: Omit<GalleryAsset, 'id' | 'createdAt'>[] = []
  const uploadedKeys: string[] = []

  try {
    for (const file of files) {
      const processed = await processImage(file, category)
      const name = file.name.replace(/\.[^.]+$/, '') || 'image'
      const blob = dataUrlToBlob(processed.dataUrl)
      const uploaded = await uploadCloudAsset(
        token,
        blob,
        `${name}.${processed.mime.split('/')[1] || 'webp'}`,
      )
      uploadedKeys.push(uploaded.key)
      assets.push({
        name,
        category,
        dataUrl: uploaded.url,
        size: uploaded.size,
        remoteKey: uploaded.key,
      })
    }
  } catch (error) {
    // Avoid orphaned objects when a later image fails.
    await Promise.allSettled(
      uploadedKeys.map((key) => deleteCloudAsset(token, key)),
    )
    throw error
  }

  return assets
}
