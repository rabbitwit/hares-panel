import { useId, useMemo } from 'react'
import { useAppStore } from '@/store/app-store'
import { getPreset } from '@/data/wallpapers'

export function NavBackground() {
  const config = useAppStore((state) => state.config)
  const gallery = useAppStore((state) => state.gallery)
  const gradientId = useId().replaceAll(':', '')
  const isLight = config.appearance === 'light'

  const wallpaper = useMemo(() => {
    const selected = config.wallpaper
    if (selected.type === 'preset') {
      const preset = getPreset(selected.presetId)
      return { type: 'preset' as const, preset, css: isLight ? preset.light : preset.dark }
    }
    if (selected.type === 'gallery') {
      const asset = gallery.find((entry) => entry.id === selected.assetId)
      return { type: 'image' as const, css: asset?.dataUrl ? `url("${asset.dataUrl}")` : '', preset: getPreset('nebula') }
    }
    return {
      type: 'image' as const,
      css: selected.url ? `url("${selected.url}")` : '',
      preset: getPreset('nebula'),
    }
  }, [config.wallpaper, gallery, isLight])

  const waves = wallpaper.preset.waves
  const overlayAlpha = Math.min(100, Math.max(0, config.overlayOpacity)) / 100

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#070a1f]" aria-hidden="true">
      <div
        className="absolute inset-[-48px] bg-cover bg-center transition-[filter] duration-500"
        style={{
          backgroundImage: wallpaper.css,
          filter: config.wallpaperBlur > 0 ? `blur(${config.wallpaperBlur}px)` : undefined,
          transform: config.wallpaperBlur > 0 ? 'scale(1.02)' : undefined,
        }}
      />

      {wallpaper.type === 'preset' && (
        <svg
          viewBox="0 0 1600 1000"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 h-full w-full opacity-70 mix-blend-screen dark:opacity-75"
        >
          <defs>
            <linearGradient id={`wave-a-${gradientId}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={waves[0]} stopOpacity="0.5" />
              <stop offset="100%" stopColor={waves[0]} stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`wave-b-${gradientId}`} x1="1" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={waves[1]} stopOpacity="0.45" />
              <stop offset="100%" stopColor={waves[1]} stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`wave-c-${gradientId}`} x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor={waves[2]} stopOpacity="0.42" />
              <stop offset="100%" stopColor={waves[2]} stopOpacity="0" />
            </linearGradient>
            <filter
              id={`blur-${gradientId}`}
              filterUnits="userSpaceOnUse"
              x="-500"
              y="-500"
              width="2600"
              height="2000"
            >
              <feGaussianBlur stdDeviation="88" />
            </filter>
          </defs>
          <path
            d="M-220 780C140 490 430 930 840 700C1150 522 1390 570 1810 760L1810 1120L-220 1120Z"
            fill={`url(#wave-a-${gradientId})`}
            filter={`url(#blur-${gradientId})`}
          />
          <path
            d="M980 -160C1150 120 1420 60 1700 210L1700 -180Z"
            fill={`url(#wave-b-${gradientId})`}
            filter={`url(#blur-${gradientId})`}
          />
          <path
            d="M420 1120C600 850 920 1050 1210 850C1410 712 1550 790 1710 920L1710 1140Z"
            fill={`url(#wave-c-${gradientId})`}
            filter={`url(#blur-${gradientId})`}
            opacity="0.9"
          />
        </svg>
      )}

      <div
        className="absolute inset-0 transition-colors duration-500"
        style={{
          backgroundColor: isLight
            ? `rgba(255, 255, 255, ${Math.min(0.82, overlayAlpha + 0.08)})`
            : `rgba(3, 6, 20, ${Math.min(0.78, overlayAlpha)})`,
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          background: isLight
            ? 'radial-gradient(ellipse 80% 65% at 50% 35%, transparent 20%, rgba(255,255,255,.4) 100%)'
            : 'radial-gradient(ellipse 90% 75% at 50% 35%, transparent 30%, rgba(2,4,14,.4) 100%)',
        }}
      />
      <div className="noise-layer absolute inset-0" />
    </div>
  )
}
