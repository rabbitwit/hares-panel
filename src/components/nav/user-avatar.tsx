import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAppStore } from '@/store/app-store'
import { resolveAssetLike } from '@/lib/resolve-asset'
import { cn } from '@/lib/utils'

interface UserAvatarProps {
  name: string
  avatar: string
  className?: string
  fallbackClassName?: string
  imageClassName?: string
}

export function userInitial(name: string) {
  const characters = Array.from(name.trim())
  return characters[0]?.toUpperCase() ?? '管'
}

export function UserAvatar({
  name,
  avatar,
  className,
  fallbackClassName,
  imageClassName,
}: UserAvatarProps) {
  const gallery = useAppStore((state) => state.gallery)
  const source = resolveAssetLike(avatar, gallery)
  const displayName = name.trim() || '管理员'

  return (
    <Avatar className={cn('border border-foreground/15', className)}>
      {source && (
        <AvatarImage
          src={source}
          alt={displayName}
          className={cn('object-cover', imageClassName)}
          draggable={false}
        />
      )}
      <AvatarFallback
        className={cn(
          'bg-gradient-to-br from-violet-500 to-fuchsia-500 text-xs font-semibold text-white',
          fallbackClassName,
        )}
      >
        {userInitial(displayName)}
      </AvatarFallback>
    </Avatar>
  )
}
