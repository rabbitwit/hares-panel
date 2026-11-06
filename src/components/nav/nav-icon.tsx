import { useEffect, useState } from 'react'
import { Icon } from '@iconify/react'
import { useAppStore } from '@/store/app-store'
import { rewriteLegacyGoogleFavicon } from '@/lib/favicon'
import { iconifyId, isEmoji, isIconifyName, isImageSource } from '@/lib/iconify'
import { colorFromString, getInitials } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface NavIconProps {
  icon: string
  iconColor?: string
  title: string
  size?: number
  className?: string
  imageClassName?: string
  /** Corner radius (px) applied to image-based icons inside the card. */
  radius?: number
}

export function NavIcon({
  icon,
  iconColor,
  title,
  size = 34,
  className,
  imageClassName,
  radius,
}: NavIconProps) {
  const gallery = useAppStore((state) => state.gallery)
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    setImageFailed(false)
  }, [icon])

  const sourceIcon = rewriteLegacyGoogleFavicon(icon)
  const resolvedIcon = sourceIcon.startsWith('gallery:')
    ? gallery.find((asset) => asset.id === sourceIcon.slice('gallery:'.length))?.dataUrl ?? ''
    : sourceIcon

  if (resolvedIcon && !imageFailed) {
    if (resolvedIcon.startsWith('data:image/') || isImageSource(resolvedIcon)) {
      return (
        <img
          src={resolvedIcon}
          alt=""
          width={size}
          height={size}
          draggable={false}
          loading="lazy"
          onError={() => setImageFailed(true)}
          className={cn(
            'object-contain drop-shadow-sm',
            imageClassName,
            className,
          )}
          style={{ width: size, height: size, ...(radius != null ? { borderRadius: radius } : {}) }}
        />
      )
    }

    if (isIconifyName(resolvedIcon)) {
      return (
        <Icon
          icon={iconifyId(resolvedIcon)}
          width={size}
          height={size}
          style={{ color: iconColor || undefined }}
          className={cn('shrink-0 drop-shadow-sm', className)}
        />
      )
    }

    if (isEmoji(resolvedIcon)) {
      return (
        <span
          className={cn('inline-flex select-none items-center justify-center leading-none', className)}
          style={{ fontSize: size * 0.86, width: size, height: size }}
          aria-hidden="true"
        >
          {resolvedIcon}
        </span>
      )
    }
  }

  const initials = getInitials(title)
  return (
    <span
      className={cn(
        'inline-flex select-none items-center justify-center rounded-xl font-semibold text-white',
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(12, size * 0.42),
        background: `linear-gradient(145deg, ${colorFromString(title)}, ${colorFromString(title + 'x')})`,
      }}
      aria-hidden="true"
    >
      {initials}
    </span>
  )
}
