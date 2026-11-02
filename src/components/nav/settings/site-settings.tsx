import { useEffect, useRef, useState } from 'react'
import { Loader2, Save, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PanelHeader, SettingsSection, SwitchRow } from './settings-ui'
import { useAppStore } from '@/store/app-store'
import { filesToGalleryAssets } from '@/lib/image'
import { resolveAssetLike } from '@/lib/resolve-asset'
import type { OpenMode } from '@/types'

export function SiteSettingsPanel() {
  const config = useAppStore((state) => state.config)
  const gallery = useAppStore((state) => state.gallery)
  const updateConfig = useAppStore((state) => state.updateConfig)
  const addGalleryAssets = useAppStore((state) => state.addGalleryAssets)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  const [draft, setDraft] = useState({
    siteName: config.siteName,
    siteTitle: config.siteTitle,
    publicAccess: config.publicAccess,
    showNetworkSwitch: config.showNetworkSwitch,
    showSearch: config.showSearch,
    searchPlaceholder: config.searchPlaceholder,
    searchInNewTab: config.searchInNewTab,
    defaultOpenMode: config.defaultOpenMode,
    footerEnabled: config.footerEnabled,
    footerText: config.footerText,
    footerHtml: config.footerHtml,
    customCss: config.customCss,
    customJs: config.customJs,
  })
  const [logoUrl, setLogoUrl] = useState(
    config.logoImage.startsWith('gallery:') ? '' : config.logoImage,
  )

  useEffect(() => {
    setDraft({
      siteName: config.siteName,
      siteTitle: config.siteTitle,
      publicAccess: config.publicAccess,
      showNetworkSwitch: config.showNetworkSwitch,
      showSearch: config.showSearch,
      searchPlaceholder: config.searchPlaceholder,
      searchInNewTab: config.searchInNewTab,
      defaultOpenMode: config.defaultOpenMode,
      footerEnabled: config.footerEnabled,
      footerText: config.footerText,
      footerHtml: config.footerHtml,
      customCss: config.customCss,
      customJs: config.customJs,
    })
    setLogoUrl(config.logoImage.startsWith('gallery:') ? '' : config.logoImage)
  }, [config])

  const save = (event: React.FormEvent) => {
    event.preventDefault()
    if (!draft.siteName.trim()) {
      toast.error('站点名称不能为空')
      return
    }
    updateConfig({
      ...draft,
      siteName: draft.siteName.trim(),
      siteTitle: draft.siteTitle.trim() || draft.siteName.trim(),
      logoImage: logoUrl.trim() || (config.logoImage.startsWith('gallery:') ? config.logoImage : ''),
    })
    toast.success('站点设置已保存')
  }

  const uploadLogo = async (files: FileList | null) => {
    if (!files?.length) return
    setUploadingLogo(true)
    try {
      const assets = await filesToGalleryAssets([files[0]], 'icon')
      const created = addGalleryAssets(assets)
      if (created[0]) {
        updateConfig({ logoImage: `gallery:${created[0].id}` })
        setLogoUrl('')
        toast.success('Logo 已更新并加入图库')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Logo 上传失败')
    } finally {
      setUploadingLogo(false)
      if (logoInputRef.current) logoInputRef.current.value = ''
    }
  }

  const currentLogo = resolveAssetLike(config.logoImage, gallery)

  return (
    <form onSubmit={save} className="space-y-5">
      <PanelHeader
        title="站点设置"
        description="控制导航页的基础信息、公开访问方式和页脚。修改会保存到服务端并对所有访客生效。"
        actions={
          <Button type="submit" size="sm">
            <Save className="mr-1.5 h-3.5 w-3.5" />
            保存设置
          </Button>
        }
      />

      <SettingsSection title="基础信息">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="site-name">站点名称</Label>
            <Input
              id="site-name"
              value={draft.siteName}
              onChange={(event) => setDraft((value) => ({ ...value, siteName: event.target.value }))}
              maxLength={40}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="site-title">浏览器标题</Label>
            <Input
              id="site-title"
              value={draft.siteTitle}
              onChange={(event) => setDraft((value) => ({ ...value, siteTitle: event.target.value }))}
              maxLength={80}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="site-logo-url">Logo 图片地址</Label>
            <div className="flex gap-2">
              <Input
                id="site-logo-url"
                value={logoUrl}
                onChange={(event) => setLogoUrl(event.target.value)}
                placeholder="留空使用默认 Logo"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => logoInputRef.current?.click()}
                title="上传 Logo"
                disabled={uploadingLogo}
              >
                {uploadingLogo ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
              </Button>
            </div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => void uploadLogo(event.target.files)}
            />
          </div>
          <div className="space-y-2">
            <Label>Logo 预览</Label>
            <div className="flex h-10 items-center gap-3 rounded-lg border border-border/70 bg-muted/20 px-3">
              <img
                src={currentLogo || `${import.meta.env.BASE_URL}logo-mark.svg`}
                alt=""
                className="h-7 w-7 rounded-lg object-cover"
              />
              <span className="text-xs text-muted-foreground">
                {currentLogo ? '自定义 Logo' : '默认 Hares Logo'}
              </span>
              <button
                type="button"
                onClick={() => {
                  updateConfig({ logoImage: '' })
                  setLogoUrl('')
                }}
                className="ml-auto text-[10px] text-muted-foreground hover:text-foreground"
              >
                恢复默认
              </button>
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="访问与导航">
        <SwitchRow
          label="公开访问（访客模式）"
          hint="关闭后，未登录访客会被重定向到登录页。"
          checked={draft.publicAccess}
          onCheckedChange={(value) => setDraft((draftValue) => ({ ...draftValue, publicAccess: value }))}
        />
        <SwitchRow
          label="显示网络环境切换"
          hint="在右上角显示内网/外网切换按钮。"
          checked={draft.showNetworkSwitch}
          onCheckedChange={(value) =>
            setDraft((draftValue) => ({ ...draftValue, showNetworkSwitch: value }))
          }
        />
        <SwitchRow
          label="显示搜索栏"
          hint="导航页顶部的搜索引擎。"
          checked={draft.showSearch}
          onCheckedChange={(value) => setDraft((draftValue) => ({ ...draftValue, showSearch: value }))}
        />
        <div className="grid gap-4 pt-2 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="search-placeholder">搜索框提示文字</Label>
            <Input
              id="search-placeholder"
              value={draft.searchPlaceholder}
              onChange={(event) =>
                setDraft((value) => ({ ...value, searchPlaceholder: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>默认打开方式</Label>
            <Select
              value={draft.defaultOpenMode}
              onValueChange={(value) =>
                setDraft((draftValue) => ({ ...draftValue, defaultOpenMode: value as OpenMode }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">新标签页</SelectItem>
                <SelectItem value="self">当前页面</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <SwitchRow
          label="在新的标签页中搜索"
          hint="关闭后，搜索结果会在当前标签页打开。"
          checked={draft.searchInNewTab}
          onCheckedChange={(value) => setDraft((draftValue) => ({ ...draftValue, searchInNewTab: value }))}
        />
      </SettingsSection>

      <SettingsSection title="页脚">
        <SwitchRow
          label="显示页脚"
          checked={draft.footerEnabled}
          onCheckedChange={(value) => setDraft((draftValue) => ({ ...draftValue, footerEnabled: value }))}
        />
        <div className="space-y-2 pt-1">
          <Label htmlFor="footer-text">页脚文字</Label>
          <Input
            id="footer-text"
            value={draft.footerText}
            onChange={(event) => setDraft((value) => ({ ...value, footerText: event.target.value }))}
            maxLength={160}
          />
        </div>
        <div className="space-y-2 pt-1">
          <Label htmlFor="footer-html">自定义页脚 HTML（可选）</Label>
          <Textarea
            id="footer-html"
            value={draft.footerHtml}
            onChange={(event) => setDraft((value) => ({ ...value, footerHtml: event.target.value }))}
            placeholder="<span>我的 NAS</span>"
            className="min-h-[70px] resize-y font-mono text-xs"
          />
          <p className="text-[10px] text-muted-foreground">
            填写后会替换页脚文字。仅支持你自己信任的 HTML，不进行服务端过滤。
          </p>
        </div>
      </SettingsSection>

      <SettingsSection
        title="高级：自定义 CSS / JS"
        description="适合对页面做深度美化或接入第三方脚本。脚本会在每次加载导航页时执行。"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="custom-css">自定义 CSS</Label>
            <Textarea
              id="custom-css"
              value={draft.customCss}
              onChange={(event) => setDraft((value) => ({ ...value, customCss: event.target.value }))}
              placeholder=".nav-item-surface { border-radius: 20px; }"
              className="min-h-[120px] resize-y font-mono text-xs leading-relaxed"
              spellCheck={false}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="custom-js">自定义 JavaScript</Label>
            <Textarea
              id="custom-js"
              value={draft.customJs}
              onChange={(event) => setDraft((value) => ({ ...value, customJs: event.target.value }))}
              placeholder="console.log('Hello Hares-Panel')"
              className="min-h-[120px] resize-y font-mono text-xs leading-relaxed"
              spellCheck={false}
            />
          </div>
        </div>
      </SettingsSection>

      <div className="flex justify-end pb-2">
        <Button type="submit">
          <Save className="mr-1.5 h-4 w-4" />
          保存站点设置
        </Button>
      </div>
    </form>
  )
}
