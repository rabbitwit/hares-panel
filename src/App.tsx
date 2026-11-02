import { useEffect } from 'react'
import {
  HashRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { NavPage } from '@/components/nav/nav-page'
import { LoginPage } from '@/components/nav/login-page'
import { BackendRequired, SiteSetup } from '@/components/nav/backend-gate'
import { useCloudAutoSave, useCloudBootstrap, useSessionKeepAlive } from '@/hooks/use-cloud'
import { useAppStore } from '@/store/app-store'
import { useCloudStore } from '@/store/cloud-store'
import { useSessionStore } from '@/store/session-store'
import { resolveAssetLike } from '@/lib/resolve-asset'

function BootScreen() {
  return (
    <div className="boot-splash">
      <img src={`${import.meta.env.BASE_URL}logo-mark.svg`} alt="" width={68} height={68} />
      <div className="boot-name">Hares-Panel</div>
      <div className="boot-dots">
        <span />
        <span />
        <span />
      </div>
    </div>
  )
}

function useSiteEffects() {
  const config = useAppStore((state) => state.config)
  const gallery = useAppStore((state) => state.gallery)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', config.appearance === 'dark')
    root.style.colorScheme = config.appearance
    const themeColor = document.querySelector('meta[name="theme-color"]')
    themeColor?.setAttribute('content', config.appearance === 'dark' ? '#070a1f' : '#eef2ff')
  }, [config.appearance])

  useEffect(() => {
    document.title = config.siteTitle.trim() || config.siteName
  }, [config.siteName, config.siteTitle])

  useEffect(() => {
    const logo = resolveAssetLike(config.logoImage, gallery)
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (link) {
      link.href = logo || `${import.meta.env.BASE_URL}favicon.svg`
    }
  }, [config.logoImage, gallery])

  useEffect(() => {
    const id = 'hares-nav-custom-css'
    let style = document.getElementById(id) as HTMLStyleElement | null
    if (!style) {
      style = document.createElement('style')
      style.id = id
      document.head.appendChild(style)
    }
    style.textContent = config.customCss
    return () => {
      style?.remove()
    }
  }, [config.customCss])

  useEffect(() => {
    const script = document.createElement('script')
    script.dataset.haresCustomJs = 'true'
    script.text = config.customJs
    if (config.customJs.trim()) {
      document.body.appendChild(script)
    }
    return () => {
      script.remove()
    }
  }, [config.customJs])
}

function RoutedApp() {
  const location = useLocation()
  const config = useAppStore((state) => state.config)
  const session = useSessionStore((state) => state.session)
  const clearSession = useSessionStore((state) => state.clearSession)
  const status = useCloudStore((state) => state.status)
  const empty = useCloudStore((state) => state.empty)

  const sessionValid = Boolean(
    session && session.expiresAt > Date.now() && status === 'connected',
  )

  useEffect(() => {
    if (session && !sessionValid) clearSession()
  }, [clearSession, session, sessionValid])

  if (status === 'unavailable') {
    return <BackendRequired />
  }

  if (empty && !sessionValid && location.pathname !== '/login') {
    return <SiteSetup />
  }

  if (!config.publicAccess && !sessionValid && location.pathname !== '/login') {
    return <Navigate to="/login" replace />
  }

  return (
    <Routes>
      <Route path="/" element={<NavPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  const cloudLoaded = useCloudStore((state) => state.loaded)
  useCloudBootstrap()
  useCloudAutoSave()
  useSessionKeepAlive()
  useSiteEffects()

  if (!cloudLoaded) return <BootScreen />

  return (
    <TooltipProvider delayDuration={220} skipDelayDuration={90}>
      <HashRouter>
        <RoutedApp />
      </HashRouter>
      <Toaster />
    </TooltipProvider>
  )
}
