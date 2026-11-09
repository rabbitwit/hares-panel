import type { WallpaperPreset } from '@/types'

export const wallpaperPresets: WallpaperPreset[] = [
  {
    id: 'nebula',
    name: '星云',
    recommendedAppearance: 'dark',
    dark:
      'radial-gradient(ellipse 75% 58% at 88% -4%, rgba(37,99,235,.68), transparent 68%), radial-gradient(ellipse 70% 70% at 4% 106%, rgba(190,24,93,.7), transparent 70%), radial-gradient(ellipse 55% 55% at 70% 102%, rgba(91,33,182,.58), transparent 70%), linear-gradient(135deg, #060a21 0%, #0a1030 45%, #1b1039 72%, #3d0d31 100%)',
    light:
      'radial-gradient(ellipse 75% 58% at 88% -4%, rgba(147,197,253,.75), transparent 68%), radial-gradient(ellipse 70% 70% at 4% 106%, rgba(251,207,232,.8), transparent 70%), radial-gradient(ellipse 55% 55% at 70% 102%, rgba(196,181,253,.55), transparent 70%), linear-gradient(135deg, #eff6ff 0%, #eef2ff 46%, #f5f3ff 72%, #fdf2f8 100%)',
    waves: ['#2563eb', '#be185d', '#7c3aed'],
  },
  {
    id: 'aurora',
    name: '极光',
    recommendedAppearance: 'dark',
    dark:
      'radial-gradient(ellipse 70% 55% at 82% 4%, rgba(13,148,136,.55), transparent 66%), radial-gradient(ellipse 65% 70% at 6% 105%, rgba(5,150,105,.42), transparent 70%), radial-gradient(ellipse 55% 60% at 72% 96%, rgba(79,70,229,.5), transparent 70%), linear-gradient(140deg, #030f18 0%, #041f26 45%, #071b2d 68%, #11103a 100%)',
    light:
      'radial-gradient(ellipse 70% 55% at 82% 4%, rgba(153,246,228,.65), transparent 66%), radial-gradient(ellipse 65% 70% at 6% 105%, rgba(167,243,208,.72), transparent 70%), radial-gradient(ellipse 55% 60% at 72% 96%, rgba(199,210,254,.55), transparent 70%), linear-gradient(140deg, #f0fdfa 0%, #ecfdf5 45%, #eff6ff 72%, #f5f3ff 100%)',
    waves: ['#0d9488', '#10b981', '#6366f1'],
  },
  {
    id: 'twilight',
    name: '暮色',
    recommendedAppearance: 'dark',
    dark:
      'radial-gradient(ellipse 70% 60% at 85% 0%, rgba(76,29,149,.72), transparent 65%), radial-gradient(ellipse 70% 70% at 2% 100%, rgba(131,24,67,.55), transparent 70%), radial-gradient(ellipse 55% 50% at 75% 100%, rgba(30,64,175,.5), transparent 72%), linear-gradient(150deg, #090718 0%, #140d29 48%, #250d30 74%, #35102a 100%)',
    light:
      'radial-gradient(ellipse 70% 60% at 85% 0%, rgba(221,214,254,.7), transparent 65%), radial-gradient(ellipse 70% 70% at 2% 100%, rgba(251,207,232,.7), transparent 70%), radial-gradient(ellipse 55% 50% at 75% 100%, rgba(191,219,254,.55), transparent 72%), linear-gradient(150deg, #f8fafc 0%, #f5f3ff 48%, #fdf2f8 100%)',
    waves: ['#6d28d9', '#9f1239', '#1d4ed8'],
  },
  {
    id: 'ember',
    name: '余烬',
    recommendedAppearance: 'dark',
    dark:
      'radial-gradient(ellipse 65% 60% at 88% 2%, rgba(194,65,12,.55), transparent 66%), radial-gradient(ellipse 70% 70% at 4% 105%, rgba(159,18,57,.62), transparent 70%), radial-gradient(ellipse 60% 55% at 65% 100%, rgba(120,53,15,.5), transparent 70%), linear-gradient(135deg, #0e0708 0%, #1a0a0d 45%, #2a0c12 72%, #160b1c 100%)',
    light:
      'radial-gradient(ellipse 65% 60% at 88% 2%, rgba(254,215,170,.72), transparent 66%), radial-gradient(ellipse 70% 70% at 4% 105%, rgba(254,205,211,.72), transparent 70%), radial-gradient(ellipse 60% 55% at 65% 100%, rgba(253,230,138,.45), transparent 70%), linear-gradient(135deg, #fffbeb 0%, #fff7ed 45%, #fef2f2 100%)',
    waves: ['#c2410c', '#9f1239', '#78350f'],
  },
  {
    id: 'graphite',
    name: '石墨',
    recommendedAppearance: 'dark',
    dark:
      'radial-gradient(ellipse 65% 58% at 84% 0%, rgba(71,85,105,.48), transparent 65%), radial-gradient(ellipse 70% 70% at 5% 102%, rgba(15,23,42,.8), transparent 68%), radial-gradient(ellipse 50% 50% at 70% 100%, rgba(51,65,85,.55), transparent 70%), linear-gradient(145deg, #080b12 0%, #0e131c 46%, #141b27 74%, #0b1018 100%)',
    light:
      'radial-gradient(ellipse 65% 58% at 84% 0%, rgba(226,232,240,.9), transparent 65%), radial-gradient(ellipse 70% 70% at 5% 102%, rgba(203,213,225,.62), transparent 68%), radial-gradient(ellipse 50% 50% at 70% 100%, rgba(241,245,249,.8), transparent 70%), linear-gradient(145deg, #f8fafc 0%, #f1f5f9 46%, #e2e8f0 100%)',
    waves: ['#475569', '#334155', '#64748b'],
  },
  {
    id: 'dawn',
    name: '晨曦',
    recommendedAppearance: 'light',
    dark:
      'radial-gradient(ellipse 68% 60% at 88% 0%, rgba(56,189,248,.35), transparent 66%), radial-gradient(ellipse 70% 70% at 4% 105%, rgba(244,114,182,.4), transparent 70%), radial-gradient(ellipse 55% 55% at 70% 100%, rgba(129,140,248,.4), transparent 70%), linear-gradient(135deg, #07132a 0%, #0d1f38 45%, #1a2144 72%, #2d1836 100%)',
    light:
      'radial-gradient(ellipse 68% 60% at 88% 0%, rgba(186,230,253,.85), transparent 66%), radial-gradient(ellipse 70% 70% at 4% 105%, rgba(251,207,232,.95), transparent 70%), radial-gradient(ellipse 55% 55% at 70% 100%, rgba(199,210,254,.75), transparent 70%), linear-gradient(135deg, #f0f9ff 0%, #fdf2f8 48%, #eef2ff 100%)',
    waves: ['#38bdf8', '#f472b6', '#818cf8'],
  },
]

export function getPreset(id: string): WallpaperPreset {
  return wallpaperPresets.find((preset) => preset.id === id) ?? wallpaperPresets[0]
}
