import { getCloudUpdate, type CloudUpdateInfo, type CloudUpdateSource } from '@/lib/cloud'
import { APP_VERSION } from '@/lib/version'

// Keep the browser-side cache in line with the server. Manual checks bypass it.
const CACHE_TTL_MS = 12 * 60 * 60 * 1000

export interface AppUpdateInfo extends Omit<CloudUpdateInfo, 'currentVersion' | 'updateAvailable'> {
  currentVersion: string
  updateAvailable: boolean
}

export const UPDATE_GUIDE_URL = 'https://github.com/rabbitwit/hares-panel#升级与版本检查'
export const UPDATE_REPOSITORY_URL = 'https://github.com/rabbitwit/hares-panel'
export const UPDATE_DOCKER_HUB_URL = 'https://hub.docker.com/r/hareswit2265/hares-panel/tags'

let cached: AppUpdateInfo | null = null
let cachedAt = 0
let pending: Promise<AppUpdateInfo> | null = null

export function updateSourceLabel(source: CloudUpdateSource) {
  switch (source) {
    case 'docker-hub':
      return 'Docker Hub'
    case 'github':
      return 'GitHub'
    default:
      return 'Docker Hub + GitHub'
  }
}

/**
 * Asks the server for the newest published version. The server proxies Docker
 * Hub / GitHub because Docker Hub does not allow cross-origin browser requests.
 */
export async function checkForAppUpdate(options: { force?: boolean } = {}): Promise<AppUpdateInfo> {
  if (!options.force && cached && Date.now() - cachedAt < CACHE_TTL_MS) return cached
  if (pending) return pending

  pending = (async () => {
    const response = await getCloudUpdate(APP_VERSION, options)
    const info: AppUpdateInfo = {
      ...response,
      currentVersion: response.currentVersion ?? APP_VERSION,
      updateAvailable: Boolean(response.updateAvailable),
    }
    cached = info
    cachedAt = Date.now()
    return info
  })().finally(() => {
    pending = null
  })

  return pending
}
