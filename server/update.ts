/**
 * Discovers the newest published Hares-Panel version.
 *
 * The browser cannot query Docker Hub directly (the API does not send CORS
 * headers), so the shared API core proxies the lookup for every runtime. Three
 * public sources are queried in parallel and the highest version wins:
 *
 * - Docker Hub tags (the image users pull);
 * - GitHub `package.json` (the source release version);
 * - jsDelivr's copy of the same file (a fallback for networks where GitHub is
 *   slow or blocked).
 *
 * Successful results are cached in memory for 12 hours to stay well below the
 * registry rate limits; failures are retried after a 10 minute cooldown.
 */

export const DOCKER_HUB_IMAGE = 'hareswit2265/hares-panel'
export const GITHUB_REPOSITORY = 'rabbitwit/hares-panel'

const DOCKER_HUB_TAGS_URL = `https://hub.docker.com/v2/repositories/${DOCKER_HUB_IMAGE}/tags?page_size=100&ordering=last_updated`
const GITHUB_PACKAGE_URL = `https://raw.githubusercontent.com/${GITHUB_REPOSITORY}/main/package.json`
const JSDELIVR_PACKAGE_URL = `https://cdn.jsdelivr.net/gh/${GITHUB_REPOSITORY}@main/package.json`
const REQUEST_TIMEOUT_MS = 8_000
// The project releases infrequently; 12 hours keeps registry traffic low while
// still picking up new versions the same day. Manual checks bypass this cache.
const CACHE_TTL_MS = 12 * 60 * 60 * 1000
// When upstream is unreachable, avoid retrying on every page load.
const FAILURE_RETRY_MS = 10 * 60 * 1000
const VERSION_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/

export type UpdateSource = 'docker-hub' | 'github' | 'docker-hub+github'

export interface LatestRelease {
  latestVersion: string
  latestTag: string | null
  image: string
  source: UpdateSource
  publishedAt: number | null
  checkedAt: number
}

interface ParsedVersion {
  major: number
  minor: number
  patch: number
  prerelease: string[]
}

interface VersionCandidate {
  version: string
  tag: string | null
  publishedAt: number | null
  origin: 'docker-hub' | 'github'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseVersion(input: string): ParsedVersion | null {
  const match = VERSION_PATTERN.exec(input.trim())
  if (!match) return null
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split('.').filter(Boolean) : [],
  }
}

/** Normalizes `v0.1.1` / `0.1.1+build` to `0.1.1`; returns null for `latest`. */
export function normalizeVersion(input: string): string | null {
  const parsed = parseVersion(input)
  if (!parsed) return null
  const base = `${parsed.major}.${parsed.minor}.${parsed.patch}`
  return parsed.prerelease.length ? `${base}-${parsed.prerelease.join('.')}` : base
}

function comparePrerelease(left: string[], right: string[]): number {
  if (left.length === 0 && right.length === 0) return 0
  if (left.length === 0) return 1
  if (right.length === 0) return -1
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const a = left[index]
    const b = right[index]
    if (a === undefined) return -1
    if (b === undefined) return 1
    if (a === b) continue
    const aNumeric = /^\d+$/.test(a)
    const bNumeric = /^\d+$/.test(b)
    if (aNumeric && bNumeric) {
      const difference = Number(a) - Number(b)
      if (difference !== 0) return difference > 0 ? 1 : -1
      continue
    }
    if (aNumeric) return -1
    if (bNumeric) return 1
    return a.localeCompare(b) > 0 ? 1 : -1
  }
  return 0
}

/** Semantic version comparison. Invalid input sorts as equal. */
export function compareVersions(left: string, right: string): number {
  const a = parseVersion(left)
  const b = parseVersion(right)
  if (!a || !b) return 0
  if (a.major !== b.major) return a.major > b.major ? 1 : -1
  if (a.minor !== b.minor) return a.minor > b.minor ? 1 : -1
  if (a.patch !== b.patch) return a.patch > b.patch ? 1 : -1
  return comparePrerelease(a.prerelease, b.prerelease)
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`${url} responded with ${response.status}`)
    return (await response.json()) as unknown
  } finally {
    clearTimeout(timer)
  }
}

function toTimestamp(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

interface DockerHubCandidate extends VersionCandidate {
  digest: string | null
}

function dockerHubCandidates(value: unknown): VersionCandidate[] {
  if (!isRecord(value) || !Array.isArray(value.results)) return []
  const tags = value.results.filter(isRecord)
  const latest = tags.find((tag) => tag.name === 'latest')
  const latestDigest = typeof latest?.digest === 'string' ? latest.digest : null
  const candidates = tags.flatMap((tag): DockerHubCandidate[] => {
    if (typeof tag.name !== 'string') return []
    const version = normalizeVersion(tag.name)
    if (!version) return []
    return [
      {
        version,
        tag: tag.name,
        publishedAt: toTimestamp(tag.last_updated),
        origin: 'docker-hub',
        digest: typeof tag.digest === 'string' ? tag.digest : null,
      },
    ]
  })
  // When `latest` exists, prefer the semver tags that point at the same image.
  // This avoids reporting a just-pushed version tag before `latest` moves.
  if (latestDigest) {
    const matching = candidates.filter((candidate) => candidate.digest === latestDigest)
    if (matching.length > 0) return matching
  }
  return candidates
}

function packageCandidate(value: unknown): VersionCandidate | null {
  if (!isRecord(value) || typeof value.version !== 'string') return null
  const version = normalizeVersion(value.version)
  if (!version) return null
  return { version, tag: null, publishedAt: null, origin: 'github' }
}

function pickLatest(candidates: VersionCandidate[]): VersionCandidate | null {
  let best: VersionCandidate | null = null
  for (const candidate of candidates) {
    if (!best || compareVersions(candidate.version, best.version) > 0) best = candidate
  }
  return best
}

export async function fetchLatestRelease(): Promise<LatestRelease> {
  const [dockerHub, github, jsdelivr] = await Promise.allSettled([
    fetchJson(DOCKER_HUB_TAGS_URL).then(dockerHubCandidates),
    fetchJson(GITHUB_PACKAGE_URL).then(packageCandidate),
    fetchJson(JSDELIVR_PACKAGE_URL).then(packageCandidate),
  ])

  const candidates: VersionCandidate[] = []
  if (dockerHub.status === 'fulfilled') candidates.push(...dockerHub.value)
  if (github.status === 'fulfilled' && github.value) candidates.push(github.value)
  if (jsdelivr.status === 'fulfilled' && jsdelivr.value) candidates.push(jsdelivr.value)

  const best = pickLatest(candidates)
  if (!best) throw new Error('No published version information is available')

  const matchesBest = (candidate: VersionCandidate) =>
    compareVersions(candidate.version, best.version) === 0
  const fromDockerHub = candidates.some(
    (candidate) => candidate.origin === 'docker-hub' && matchesBest(candidate),
  )
  const fromGithub = candidates.some(
    (candidate) => candidate.origin === 'github' && matchesBest(candidate),
  )
  const source: UpdateSource =
    fromDockerHub && fromGithub
      ? 'docker-hub+github'
      : fromDockerHub
        ? 'docker-hub'
        : 'github'

  return {
    latestVersion: best.version,
    latestTag: best.tag,
    image: DOCKER_HUB_IMAGE,
    source,
    publishedAt: best.publishedAt,
    checkedAt: Date.now(),
  }
}

let cached: { value: LatestRelease; expiresAt: number } | null = null
let failure: { error: unknown; retryAt: number } | null = null
let pending: Promise<LatestRelease> | null = null

export async function getLatestRelease(options: { force?: boolean } = {}): Promise<LatestRelease> {
  const now = Date.now()
  if (!options.force && cached && cached.expiresAt > now) return cached.value
  if (!options.force && failure) {
    if (failure.retryAt > now) throw failure.error
    failure = null
  }
  if (pending) return pending

  pending = fetchLatestRelease()
    .then((value) => {
      cached = { value, expiresAt: Date.now() + CACHE_TTL_MS }
      failure = null
      return value
    })
    .catch((error: unknown) => {
      failure = { error, retryAt: Date.now() + FAILURE_RETRY_MS }
      throw error
    })
    .finally(() => {
      pending = null
    })

  return pending
}
