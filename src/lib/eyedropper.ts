/**
 * Screen colour picking.
 *
 * The EyeDropper API samples any pixel on screen, which is what makes it
 * useful here: the user can pick a colour straight out of a site's favicon
 * instead of guessing a hex value. It ships in Chromium browsers only, so
 * callers must handle `isEyedropperSupported()` being false.
 */

interface EyeDropperResult {
  sRGBHex: string
}

interface EyeDropperInstance {
  open: (options?: { signal?: AbortSignal }) => Promise<EyeDropperResult>
}

type EyeDropperConstructor = new () => EyeDropperInstance

declare global {
  interface Window {
    EyeDropper?: EyeDropperConstructor
  }
}

export function isEyedropperSupported() {
  return typeof window !== 'undefined' && typeof window.EyeDropper === 'function'
}

/**
 * Opens the picker and resolves with a `#rrggbb` colour, or `null` when the
 * user cancels or the browser refuses the request.
 */
export async function pickScreenColor(): Promise<string | null> {
  if (!isEyedropperSupported()) return null
  try {
    const result = await new window.EyeDropper!().open()
    const hex = result.sRGBHex
    return /^#[0-9a-f]{6}$/i.test(hex) ? hex.toLowerCase() : null
  } catch {
    // AbortError when dismissed with Esc; anything else is equally non-fatal.
    return null
  }
}

/**
 * `#rgb`/`#rrggbb` as a six-digit value, for controls that accept nothing else
 * (`<input type="color">`). Returns `fallback` for other formats rather than
 * silently pretending the colour is white.
 */
export function toHex6(color: string, fallback = '#ffffff') {
  const value = color.trim()
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase()
  if (/^#[0-9a-f]{3}$/i.test(value)) {
    const [r, g, b] = value.slice(1).split('')
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  return fallback
}
