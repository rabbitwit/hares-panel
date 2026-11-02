import { useRef, useState } from 'react'
import {
  AlertTriangle,
  Cloud,
  Database,
  Download,
  HardDrive,
  Images,
  Loader2,
  RefreshCcw,
  ShieldAlert,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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
import { PanelHeader, SettingsSection } from './settings-ui'
import { getAppData, useAppStore } from '@/store/app-store'
import { useCloudStore } from '@/store/cloud-store'
import { backupFilename, parseBackupFile, serializeBackup, type ParsedBackup } from '@/lib/backup'
import { cloudAssetLabel, cloudStorageLabel } from '@/lib/cloud'
import { downloadFile, formatBytes } from '@/lib/utils'

export function BackupSettingsPanel() {
  const gallery = useAppStore((state) => state.gallery)
  const groups = useAppStore((state) => state.groups)
  const items = useAppStore((state) => state.items)
  const importData = useAppStore((state) => state.importData)
  const resetToDemo = useAppStore((state) => state.resetToDemo)
  const info = useCloudStore((state) => state.info)
  const lastSyncAt = useCloudStore((state) => state.lastSyncAt)
  const push = useCloudStore((state) => state.push)
  const inputRef = useRef<HTMLInputElement>(null)
  const [pendingImport, setPendingImport] = useState<{
    parsed: ParsedBackup
    filename: string
  } | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [reading, setReading] = useState(false)
  const [importing, setImporting] = useState(false)

  const gallerySize = gallery.reduce((sum, asset) => sum + asset.size, 0)
  const cloudAssets = Boolean(info?.assets)

  const exportData = () => {
    try {
      const content = serializeBackup(getAppData())
      downloadFile(backupFilename(), content)
      toast.success('备份已导出')
    } catch {
      toast.error('导出失败，请稍后重试')
    }
  }

  const readFile = async (file: File | undefined) => {
    if (!file) return
    if (file.size > 80 * 1024 * 1024) {
      toast.error('备份文件超过 80 MB，无法导入')
      return
    }
    setReading(true)
    try {
      const text = await file.text()
      const parsed = parseBackupFile(text)
      setPendingImport({ parsed, filename: file.name })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '读取备份失败')
    } finally {
      setReading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const confirmImport = async () => {
    if (!pendingImport) return
    setImporting(true)
    importData(pendingImport.parsed.data)
    const ok = await push()
    setImporting(false)
    setPendingImport(null)
    if (ok) toast.success('备份已导入并保存到服务端')
    else toast.error(useCloudStore.getState().error || '已导入当前会话，但保存失败')
  }

  const reset = async () => {
    resetToDemo()
    setResetOpen(false)
    const ok = await push()
    if (ok) toast.success('已恢复示例数据并保存到服务端')
    else toast.error(useCloudStore.getState().error || '示例数据已恢复，但保存失败')
  }

  return (
    <div className="space-y-5">
      <PanelHeader
        title="备份与恢复"
        description="导出服务端导航数据的 JSON 快照；导入支持 Hares-Panel、FlatNas 与 Sun-Panel 备份，可把其他面板的分组和卡片迁移过来。"
      />

      {!cloudAssets && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-[11px] leading-relaxed text-amber-700 dark:text-amber-200">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          当前服务端未配置对象存储（R2 / Vercel Blob / EdgeOne Blob / Docker 本地目录），图库上传不可用。请先配置存储后重新部署。
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: '分组', value: groups.length },
          { label: '卡片', value: items.length },
          { label: '图库图片', value: gallery.length },
        ].map((entry) => (
          <div key={entry.label} className="rounded-xl border border-border/70 bg-card/40 px-4 py-3">
            <div className="text-[10px] text-muted-foreground">{entry.label}</div>
            <div className="mt-1 font-display text-xl font-semibold tabular-nums">{entry.value}</div>
          </div>
        ))}
      </div>

      <SettingsSection
        title="导出备份"
        description="建议在修改大量内容或升级前导出一份。备份文件不加密，请妥善保管。"
      >
        <div className="flex flex-col rounded-xl border border-border/70 bg-background/30 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Database className="h-4 w-4 text-primary" />
            完整数据快照
          </div>
          <p className="mt-1 flex-1 text-[11px] leading-relaxed text-muted-foreground">
            包含站点配置、分组、卡片、搜索引擎、页脚与自定义 CSS/JS，以及图库的图片地址与对象 key。
            同一部署内可直接恢复；迁移部署时请同步 R2 / Blob / Docker `data/assets` 对象。
          </p>
          <Button type="button" size="sm" className="mt-3 self-start" onClick={exportData}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            导出备份
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection title="导入备份">
        <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border/80 bg-muted/15 p-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Upload className="h-4 w-4" />
              选择 Hares-Panel、FlatNas 或 Sun-Panel 备份文件
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              FlatNas / Sun-Panel 备份中的分组、卡片、内外网地址、打开方式与图标会自动转换；导入会覆盖服务端当前导航内容，并自动保存。
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={reading || importing}
          >
            {reading ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-1.5 h-4 w-4" />
            )}
            选择文件
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json,.navbak"
            className="hidden"
            onChange={(event) => void readFile(event.target.files?.[0])}
          />
        </div>
      </SettingsSection>

      <SettingsSection title="服务端存储" description="导航数据与图片都保存在服务端。">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <Cloud className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-xs font-medium">元数据存储</div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  {cloudStorageLabel(info?.storage)}
                </div>
              </div>
            </div>
            <span className="text-xs font-medium">已连接</span>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <Images className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-xs font-medium">图片存储</div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  {cloudAssetLabel(info?.assets ?? null)}
                </div>
              </div>
            </div>
            <span className="text-xs font-medium">{formatBytes(gallerySize)}</span>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-xs font-medium">上次保存</div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  修改后约 1.5 秒自动保存
                </div>
              </div>
            </div>
            <span className="text-xs font-medium">
              {lastSyncAt ? new Date(lastSyncAt).toLocaleString('zh-CN') : '尚未保存'}
            </span>
          </div>
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            清除浏览器数据或更换设备不会影响服务端数据；重新登录即可读取。R2 / Vercel Blob / EdgeOne Blob / Docker `data/assets` 中的图片不会包含在 JSON 备份中。
          </p>
        </div>
      </SettingsSection>

      <SettingsSection title="危险操作">
        <div className="flex flex-col gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-sm font-medium text-red-400">
              <AlertTriangle className="h-4 w-4" />
              恢复示例数据
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              清空当前导航并恢复内置示例内容，保存到服务端后生效。此操作不会恢复或修改登录密码。
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
            onClick={() => setResetOpen(true)}
          >
            <RefreshCcw className="mr-1.5 h-4 w-4" />
            重置数据
          </Button>
        </div>
      </SettingsSection>

      <AlertDialog open={Boolean(pendingImport)} onOpenChange={(value) => !value && setPendingImport(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>导入这份备份？</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  即将用“{pendingImport?.filename}”覆盖服务端当前导航内容。建议先导出一份当前数据作为保险。
                </p>
                {pendingImport && (
                  <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-border/70 bg-muted/25 p-3 text-[11px]">
                    <span>
                      来源：
                      {pendingImport.parsed.summary.source === 'flatnas'
                        ? 'FlatNas'
                        : pendingImport.parsed.summary.source === 'sun-panel'
                          ? 'Sun-Panel'
                          : 'Hares-Panel'}
                    </span>
                    <span>分组：{pendingImport.parsed.summary.groups}</span>
                    <span>卡片：{pendingImport.parsed.summary.items}</span>
                    <span>图片：{pendingImport.parsed.summary.gallery}</span>
                    <span>搜索引擎：{pendingImport.parsed.summary.engines}</span>
                    <span className="col-span-2 truncate text-muted-foreground">
                      导出时间：
                      {pendingImport.parsed.summary.exportedAt
                        ? new Date(pendingImport.parsed.summary.exportedAt).toLocaleString('zh-CN')
                        : '未提供'}
                    </span>
                  </div>
                )}
                {pendingImport?.parsed.warnings.map((warning) => (
                  <div
                    key={warning}
                    className="flex gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-2 text-[10px] leading-relaxed text-amber-700 dark:text-amber-200"
                  >
                    <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" />
                    {warning}
                  </div>
                ))}
                <div className="flex gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-2 text-[10px] leading-relaxed text-amber-700 dark:text-amber-200">
                  <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" />
                  备份只保存图片地址，不含图片二进制；跨部署迁移时请同步图片存储（R2 / Blob / Docker `data/assets`），或重新上传图片。
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={importing}>取消</AlertDialogCancel>
            <AlertDialogAction disabled={importing} onClick={() => void confirmImport()}>
              {importing ? '导入中…' : '确认导入'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>恢复示例数据？</AlertDialogTitle>
            <AlertDialogDescription>
              当前服务端的分组、卡片和图库引用都会被替换为内置示例内容，操作无法撤销。登录状态与密码不受影响。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void reset()}
            >
              恢复示例数据
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
