import { useAppStore } from '@/store/app-store'
import { resolveAssetLike } from '@/lib/resolve-asset'
import { cn } from '@/lib/utils'

interface SiteLogoProps {
  className?: string
  markClassName?: string
  textClassName?: string
  showText?: boolean
  /** Whether to show the logo image mark; when false, only the name text is shown. */
  showLogoMark?: boolean
}

export function SiteLogo({
  className,
  markClassName,
  textClassName,
  showText = true,
  showLogoMark = true,
}: SiteLogoProps) {
  const config = useAppStore((state) => state.config)
  const gallery = useAppStore((state) => state.gallery)
  const logoImage = resolveAssetLike(config.logoImage, gallery)

  return (
    <div className={cn('flex items-center gap-3.5', className)}>
      {showLogoMark && (
        <>
          {logoImage ? (
            <img
              src={logoImage}
              alt=""
              className={cn('h-11 w-11 rounded-2xl object-cover shadow-lg', markClassName)}
              draggable={false}
            />
          ) : (
            <img
              src={`${import.meta.env.BASE_URL}logo-mark.svg`}
              alt=""
              className={cn('h-11 w-11 rounded-1xl drop-shadow-[0_6px_12px_rgba(79,70,229,.28)]', markClassName)}
              draggable={false}
            />
          )}
        </>
      )}
      {showText && (
        <span className={cn('font-display text-[26px] font-extrabold tracking-[-0.04em]', textClassName)}>
          {config.siteName}
        </span>
      )}
    </div>
  )
}
