import { useEffect, useId, useMemo, useState } from 'react'
import { useAppStore } from '@/store/app-store'
import { getPreset } from '@/data/wallpapers'
import { fetchBingWallpaperUrl } from '@/lib/bing'
import { colorWithAlpha, cn } from '@/lib/utils'

/**
 * Blurred colour pools scattered behind the navigation content.
 *
 * A backdrop blur only shows its work when there is detail to smear: over the
 * smooth gradient presets the frosted pane ends up the exact same tint as the
 * wallpaper beneath, so it reads as a flat overlay instead of glass. (Blurring
 * the gradient layer itself cannot help, since a blurred gradient is still the
 * same gradient.) These pools give the panes colour transitions to pick up -- the
 * matching Bing photo, with its grain and detail, is why the effect works there.
 */
function bokehLayer(colors: string[]) {
  const [a, b, c] = colors
  const patch = (color: string, x: number, y: number, size: number, alpha: number) =>
    'radial-gradient(circle ' +
    size +
    'px at ' +
    x +
    '% ' +
    y +
    '%, ' +
    colorWithAlpha(color, alpha) +
    ', transparent 68%)'

  // Localised pools rather than page-sized washes: the panes need the colour to
  // change *across* their own width, otherwise a 14px blur still averages out to
  // one flat tint. Six pools roughly follow the icon rows and card grid so every
  // section has a colour transition behind it.
  return [
    patch(a, 12, 28, 360, 0.6),
    patch(b, 88, 24, 380, 0.56),
    patch(c, 28, 50, 330, 0.54),
    patch(b, 74, 54, 350, 0.56),
    patch(a, 44, 72, 380, 0.5),
    patch(c, 82, 84, 320, 0.48),
  ].join(', ')
}

export function NavBackground() {
  const config = useAppStore((state) => state.config)
  const gallery = useAppStore((state) => state.gallery)
  const gradientId = useId().replaceAll(':', '')
  const isLight = config.appearance === 'light'
  const [bingUrl, setBingUrl] = useState('')

  useEffect(() => {
    let alive = true
    if (config.wallpaper.type !== 'bing') {
      setBingUrl('')
      return
    }
    setBingUrl('')
    // The image is resolved through our same-origin proxy, so this never hits
    // the upstream CORS policy that blocks a direct browser fetch.
    void fetchBingWallpaperUrl(config.bingWallpaperUrl).then((url) => {
      if (alive && url) setBingUrl(url)
    })
    return () => {
      alive = false
    }
  }, [config.wallpaper.type, config.bingWallpaperUrl])

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
    if (selected.type === 'bing') {
      return {
        type: 'image' as const,
        css: bingUrl ? `url("${bingUrl}")` : '',
        preset: getPreset('nebula'),
      }
    }
    return {
      type: 'image' as const,
      css: selected.url ? `url("${selected.url}")` : '',
      preset: getPreset('nebula'),
    }
  }, [config.wallpaper, gallery, isLight, bingUrl])

  // Adapt the nav text colour to the wallpaper. Text never gets a glyph halo --
  // a text-shadow renders as a dark rim around every letter, which reads as a
  // black slab inside the cards. Contrast comes from the ink colour and the pane.
  useEffect(() => {
    const root = document.documentElement
    const bing = config.wallpaper.type === 'bing'
    root.classList.toggle('wallpaper-bing', bing)

    const applyInk = (dark: boolean) => {
      root.style.setProperty('--nav-ink', dark ? '#f2f4fa' : '#141726')
    }
    let alive = true
    let image: HTMLImageElement | null = null

    if (bing || wallpaper.type === 'preset') {
      // Presets ship a matching light/dark variant. Bing uses the same rule so a
      // bright sky behind a dark subject cannot invert the overlay into fog.
      applyInk(!isLight)
      return () => {
        alive = false
        root.classList.remove('wallpaper-bing')
      }
    }

    const match = /url\(["']?([^"')]+)["']?\)/.exec(wallpaper.css)
    const src = match?.[1]
    if (!src) {
      applyInk(true)
      return () => {
        alive = false
        root.classList.remove('wallpaper-bing')
      }
    }

    image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      if (!alive) return
      try {
        const canvas = document.createElement('canvas')
        canvas.width = image!.naturalWidth
        canvas.height = image!.naturalHeight
        const context = canvas.getContext('2d', { willReadFrequently: true })
        if (context) {
          context.drawImage(image!, 0, 0)
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
          let sum = 0
          let count = 0
          for (let index = 0; index < pixels.length; index += 40) {
            sum += 0.299 * pixels[index] + 0.587 * pixels[index + 1] + 0.114 * pixels[index + 2]
            count += 1
          }
          applyInk(count > 0 ? sum / count < 110 : true)
        } else {
          applyInk(true)
        }
      } catch {
        applyInk(true)
      }
    }
    image.onerror = () => {
      if (alive) applyInk(true)
    }
    image.src = src
    return () => {
      alive = false
      root.classList.remove('wallpaper-bing')
      if (image) {
        image.onload = null
        image.onerror = null
      }
    }
  }, [wallpaper, config.wallpaper.type, isLight])

  const waves = wallpaper.preset.waves
  const overlayAlpha = Math.min(100, Math.max(0, config.overlayOpacity)) / 100

  // Photos are busy, so a healthy scrim keeps text readable. The built-in presets
  // are smooth gradients that are already dimmed by their own base colour — layering
  // the full photo scrim on top flattens them into a single tone and the frosted panes
  // stop showing anything at all. With glass enabled the scrim is pulled back so the
  // cards actually refract the wallpaper, and the gradient waves are blurred behind
  // the content so the backdrop filter has real detail to work with.
  const preset = wallpaper.type === 'preset'
  const bing = config.wallpaper.type === 'bing'
  const glassPreset = preset && config.glassEffect
  const overlayScale = preset ? (glassPreset ? 0.45 : 0.7) : 1
  // Bing copy carries neither a glyph halo nor a plate, so the theme veil itself
  // guarantees contrast: a slightly higher floor that dims the photo uniformly
  // (dark veil on dark theme, white on light) without touching its colours.
  const overlayFloor = bing ? 0.32 : 0
  const lightBase = preset ? 0.05 : 0
  const darkOverlay = Math.max(overlayFloor, Math.min(0.78, overlayAlpha) * overlayScale)
  const lightOverlay = Math.max(overlayFloor, Math.min(0.82, overlayAlpha * overlayScale + lightBase))
  const lightScrim = preset ? (glassPreset ? 0.18 : 0.24) : 0.22
  const darkScrim = preset ? (glassPreset ? 0.24 : 0.34) : 0.4

  const presetBokeh = useMemo(() => bokehLayer(waves), [waves])

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#070a1f]" aria-hidden="true">
      <div
        className={cn(
          'wallpaper-layer absolute inset-[-48px] bg-cover bg-center',
          glassPreset && 'wallpaper-preset',
        )}
        style={{
          backgroundImage: wallpaper.css,
          filter: config.wallpaperBlur > 0 ? `blur(${config.wallpaperBlur}px)` : undefined,
          transform: config.wallpaperBlur > 0 ? 'scale(1.02)' : undefined,
        }}
      />

      {preset && (
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
            ? `rgba(255, 255, 255, ${lightOverlay})`
            : `rgba(3, 6, 20, ${darkOverlay})`,
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          background: isLight
            ? `radial-gradient(ellipse 80% 65% at 50% 35%, transparent 20%, rgba(255,255,255,${lightScrim}) 100%)`
            : `radial-gradient(ellipse 90% 75% at 50% 35%, transparent 30%, rgba(2,4,14,${darkScrim}) 100%)`,
        }}
      />

      {glassPreset && (
        <div
          className={
            'wallpaper-bokeh absolute -inset-16 ' +
            (isLight ? 'opacity-70' : 'opacity-80 mix-blend-screen')
          }
          style={{ backgroundImage: presetBokeh }}
        />
      )}

      <div className="noise-layer absolute inset-0" />
    </div>
  )
}
