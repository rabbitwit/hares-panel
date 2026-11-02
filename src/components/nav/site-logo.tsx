import { useAppStore } from '@/store/app-store'
import { resolveAssetLike } from '@/lib/resolve-asset'
import { cn } from '@/lib/utils'

interface SiteLogoProps {
  className?: string
  markClassName?: string
  textClassName?: string
  showText?: boolean
}

export function SiteLogo({ className, markClassName, textClassName, showText = true }: SiteLogoProps) {
  const config = useAppStore((state) => state.config)
  const gallery = useAppStore((state) => state.gallery)
  const logoImage = resolveAssetLike(config.logoImage, gallery)

  return (
    <div className={cn('flex items-center gap-3.5', className)}>
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
          className={cn('h-11 w-11 rounded-2xl drop-shadow-xl', markClassName)}
          draggable={false}
        />
      )}
      {showText && (
        <span className={cn('font-display text-[26px] font-extrabold tracking-[-0.04em]', textClassName)}>
          {config.siteName}
        </span>
      )}
    </div>
  )
}
