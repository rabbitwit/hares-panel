import { useAppStore } from '@/store/app-store'
import { useClock } from '@/hooks/use-clock'
import { formatDate, formatDateParts, formatTime } from '@/lib/utils'
import { SiteLogo } from '@/components/nav/site-logo'

export function NavHeader() {
  const config = useAppStore((state) => state.config)
  const now = useClock(config.showClock)
  const showName = config.showLogo
  const showLogoMark = config.showLogoMark
  const showBrand = showName || showLogoMark
  const showClock = config.showClock
  if (!showBrand && !showClock) return null

  const time = formatTime(now, { seconds: config.showSeconds, use24Hour: config.use24Hour })
  const { day, weekday } = formatDateParts(now)

  return (
    <header className="flex flex-col items-center">
      {showBrand ? (
        <div className="flex items-center justify-center gap-4 sm:gap-6">
          <div className="flex items-center">
            <SiteLogo
              showLogoMark={showLogoMark}
              showText={showName}
              textClassName="text-shadow-nav text-[30px] nav-ink sm:text-[36px] lg:text-[42px]"
              markClassName="h-10 w-10 sm:h-12 sm:w-12"
            />
          </div>

          {showClock && (
            <>
              <div className="h-11 w-px bg-foreground/20 sm:h-14 dark:bg-foreground/20" aria-hidden="true" />
              <div className="pb-0.5 text-left">
                <div className="text-shadow-nav font-display text-[26px] font-bold leading-none tabular-nums tracking-[-0.03em] nav-ink sm:text-[32px]">
                  {time}
                </div>
                {config.showDate && (
                  <div className="text-shadow-nav mt-1.5 text-[11px] font-medium nav-ink-soft-2 sm:text-xs">
                    {formatDate(now)}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center gap-4 sm:gap-5">
          <div className="text-shadow-nav font-display text-[32px] font-bold leading-none tabular-nums tracking-[-0.04em] nav-ink sm:text-[40px]">
            {time}
          </div>
          {config.showDate && (
            <>
              <div className="h-8 w-px bg-foreground/20 sm:h-10" aria-hidden="true" />
              <div className="text-shadow-nav flex flex-col justify-center gap-1.5 text-left text-[12px] font-medium leading-none tracking-[0.08em] nav-ink-soft-2 sm:text-[13px]">
                <span>{day}</span>
                <span>{weekday}</span>
              </div>
            </>
          )}
        </div>
      )}
    </header>
  )
}
