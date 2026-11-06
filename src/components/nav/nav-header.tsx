import { useAppStore } from '@/store/app-store'
import { useClock } from '@/hooks/use-clock'
import { formatDate, formatTime } from '@/lib/utils'
import { SiteLogo } from '@/components/nav/site-logo'

export function NavHeader() {
  const config = useAppStore((state) => state.config)
  const now = useClock(config.showClock)
  const showLogo = config.showLogo
  const showLogoMark = config.showLogoMark
  const showClock = config.showClock
  if (!showLogo && !showClock) return null

  return (
    <header className="flex flex-col items-center">
      <div className="flex items-center justify-center gap-4 sm:gap-6">
        {showLogo && (
          <div className="flex items-center">
            <SiteLogo
              showLogoMark={showLogoMark}
              showText={showLogo}
              textClassName="text-shadow-nav text-[30px] text-foreground sm:text-[36px] lg:text-[42px]"
              markClassName="h-10 w-10 sm:h-12 sm:w-12"
            />
          </div>
        )}

        {showLogo && showClock && (
          <div className="h-11 w-px bg-foreground/20 sm:h-14 dark:bg-foreground/20" aria-hidden="true" />
        )}

        {showClock && (
          <div className="pb-0.5 text-left">
            <div className="text-shadow-nav font-display text-[26px] font-bold leading-none tabular-nums tracking-[-0.03em] text-foreground sm:text-[32px]">
              {formatTime(now, { seconds: config.showSeconds, use24Hour: config.use24Hour })}
            </div>
            {config.showDate && (
              <div className="text-shadow-nav mt-1.5 text-[11px] font-medium text-foreground/65 sm:text-xs">
                {formatDate(now)}
              </div>
            )}
          </div>
        )}
      </div>

      {!showLogo && showClock && (
        <div className="text-shadow-nav mt-3 text-[13px] font-medium text-foreground/50">
          {config.siteName}
        </div>
      )}
    </header>
  )
}
