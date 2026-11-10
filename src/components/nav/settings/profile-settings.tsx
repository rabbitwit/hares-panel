import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Loader2, Save, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PanelHeader, SettingsSection } from './settings-ui'
import { UserAvatar } from '@/components/nav/user-avatar'
import { useAppStore } from '@/store/app-store'
import { filesToGalleryAssets } from '@/lib/image'

export function ProfileSettingsPanel() {
  const config = useAppStore((state) => state.config)
  const updateConfig = useAppStore((state) => state.updateConfig)
  const addGalleryAssets = useAppStore((state) => state.addGalleryAssets)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [name, setName] = useState(config.adminName)
  const [avatarUrl, setAvatarUrl] = useState(
    config.adminAvatar.startsWith('gallery:') ? '' : config.adminAvatar,
  )

  useEffect(() => {
    setName(config.adminName)
  }, [config.adminName])

  useEffect(() => {
    setAvatarUrl(config.adminAvatar.startsWith('gallery:') ? '' : config.adminAvatar)
  }, [config.adminAvatar])

  const galleryAvatar = config.adminAvatar.startsWith('gallery:') ? config.adminAvatar : ''
  const previewName = name.trim() || '管理员'
  const previewAvatar = avatarUrl.trim() || galleryAvatar

  const save = (event: React.FormEvent) => {
    event.preventDefault()
    const nextName = name.trim()
    if (!nextName) {
      toast.error('显示名称不能为空')
      return
    }
    updateConfig({
      adminName: nextName,
      adminAvatar: avatarUrl.trim() || galleryAvatar,
    })
    toast.success('个人资料已保存')
  }

  const uploadAvatar = async (files: FileList | null) => {
    if (!files?.length) return
    setUploadingAvatar(true)
    try {
      const assets = await filesToGalleryAssets([files[0]], 'avatar')
      const created = addGalleryAssets(assets)
      if (created[0]) {
        updateConfig({ adminAvatar: `gallery:${created[0].id}` })
        setAvatarUrl('')
        toast.success('头像已更新')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '头像上传失败')
    } finally {
      setUploadingAvatar(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  const removeAvatar = () => {
    setAvatarUrl('')
    updateConfig({ adminAvatar: '' })
    toast.success('已恢复默认头像')
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <PanelHeader
        title="个人资料"
        description="自定义登录后显示的头像和名称。资料会保存到服务端，并显示在右上角账户菜单与管理控制台中。"
        actions={
          <Button type="submit" size="sm">
            <Save className="mr-1.5 h-3.5 w-3.5" />
            保存资料
          </Button>
        }
      />

      <SettingsSection title="头像与显示名称">
        <div className="flex flex-col gap-6 sm:flex-row">
          <div className="flex shrink-0 flex-col items-center gap-3">
            <UserAvatar
              name={previewName}
              avatar={previewAvatar}
              className="h-24 w-24 border-2 shadow-lg"
              fallbackClassName="text-3xl"
            />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
              >
                {uploadingAvatar ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                )}
                上传头像
              </Button>
              {previewAvatar && (
                <Button type="button" variant="ghost" size="sm" onClick={removeAvatar}>
                  移除
                </Button>
              )}
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => void uploadAvatar(event.target.files)}
            />
            <p className="max-w-40 text-center text-[10px] leading-relaxed text-muted-foreground">
              建议使用正方形图片，上传后会自动压缩并保存到头像目录。
            </p>
          </div>

          <div className="min-w-0 flex-1 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-name">显示名称</Label>
              <Input
                id="admin-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="管理员"
                maxLength={24}
              />
              <p className="text-[10px] text-muted-foreground">
                会显示在右上角的账户菜单中，留空时将使用“管理员”。
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-avatar-url">头像图片地址</Label>
              <div className="flex gap-2">
                <Input
                  id="admin-avatar-url"
                  value={avatarUrl}
                  onChange={(event) => setAvatarUrl(event.target.value)}
                  placeholder="https://example.com/avatar.png"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => avatarInputRef.current?.click()}
                  title="上传头像"
                  disabled={uploadingAvatar}
                >
                  {uploadingAvatar ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ImagePlus className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                可以直接填写图片链接，或点击右侧按钮上传本地图片。留空并使用“移除”会显示默认头像。
              </p>
            </div>

            <div className="rounded-xl border border-border/70 bg-muted/20 px-3 py-2.5">
              <div className="mb-2 text-[10px] font-medium text-muted-foreground">账户菜单预览</div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/60 py-1 pl-1 pr-3">
                <UserAvatar
                  name={previewName}
                  avatar={previewAvatar}
                  className="h-8 w-8"
                  fallbackClassName="text-xs"
                />
                <span className="max-w-40 truncate text-xs font-medium">{previewName}</span>
              </div>
            </div>
          </div>
        </div>
      </SettingsSection>

      <div className="flex justify-end pb-2">
        <Button type="submit">
          <Save className="mr-1.5 h-4 w-4" />
          保存个人资料
        </Button>
      </div>
    </form>
  )
}
