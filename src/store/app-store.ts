import { create } from 'zustand'
import { demoData } from '@/data/demo'
import { rewriteLegacyGoogleFavicon } from '@/lib/favicon'
import { generateId } from '@/lib/utils'
import type {
  AppData,
  GalleryAsset,
  NavGroup,
  NavItem,
  SearchEngine,
  SiteConfig,
} from '@/types'

interface GroupInput {
  name: string
  description?: string
  style?: NavGroup['style']
  hidden?: boolean
  collapsed?: boolean
}

interface ItemInput {
  groupId: string
  title: string
  description?: string
  url?: string
  lanUrl?: string
  icon?: string
  iconColor?: string
  badge?: string
  openMode?: NavItem['openMode']
  hidden?: boolean
}

interface AppActions {
  updateConfig: (patch: Partial<SiteConfig>) => void
  addGroup: (input: GroupInput) => string
  updateGroup: (id: string, patch: Partial<Omit<NavGroup, 'id'>>) => void
  removeGroup: (id: string) => void
  moveGroup: (id: string, direction: -1 | 1) => void
  reorderGroups: (ids: string[]) => void
  addItem: (input: ItemInput) => string
  updateItem: (id: string, patch: Partial<Omit<NavItem, 'id'>>) => void
  removeItem: (id: string) => void
  duplicateItem: (id: string) => void
  moveItem: (id: string, targetGroupId: string, targetIndex: number) => void
  addSearchEngine: (input: Omit<SearchEngine, 'id' | 'sort'>) => string
  updateSearchEngine: (id: string, patch: Partial<Omit<SearchEngine, 'id'>>) => void
  removeSearchEngine: (id: string) => void
  moveSearchEngine: (id: string, direction: -1 | 1) => void
  addGalleryAssets: (assets: Omit<GalleryAsset, 'id' | 'createdAt'>[]) => GalleryAsset[]
  removeGalleryAsset: (id: string) => void
  importData: (data: AppData) => void
  applyRemoteState: (data: AppData) => void
  resetToDemo: () => void
}

export type AppStore = AppData & AppActions

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

function normalizeGroups(groups: NavGroup[]) {
  return groups.map((group, index) => ({
    ...group,
    hidden: Boolean(group.hidden),
    collapsed: Boolean(group.collapsed),
    sort: index,
  }))
}

/** `window` was removed; migrate legacy cards to the new-tab mode. */
function normalizeOpenMode(value: string): NavItem['openMode'] {
  return value === 'self' ? 'self' : 'new'
}

function normalizeItem(item: NavItem): NavItem {
  return {
    id: item.id,
    groupId: item.groupId,
    title: item.title,
    description: item.description,
    url: item.url,
    lanUrl: item.lanUrl,
    icon: rewriteLegacyGoogleFavicon(item.icon || ''),
    iconColor: item.iconColor,
    badge: item.badge,
    openMode: normalizeOpenMode(item.openMode as string),
    hidden: item.hidden,
    sort: item.sort,
    createdAt: item.createdAt,
  }
}

function normalizeConfig(config: SiteConfig): SiteConfig {
  return {
    ...config,
    adminName: config.adminName?.trim() || '管理员',
    adminAvatar: config.adminAvatar || '',
    defaultOpenMode: normalizeOpenMode(config.defaultOpenMode as string),
  }
}

function normalizeGroupItems(items: NavItem[], groupId: string) {
  return items
    .filter((item) => item.groupId === groupId)
    .sort((a, b) => a.sort - b.sort)
    .map((item, index) => ({ ...item, sort: index }))
}

function itemNextSort(items: NavItem[], groupId: string) {
  const groupItems = items.filter((item) => item.groupId === groupId)
  return groupItems.length ? Math.max(...groupItems.map((item) => item.sort)) + 1 : 0
}

function createInitialState(): AppData {
  return clone(demoData)
}

export const useAppStore = create<AppStore>()((set, get) => ({
      ...createInitialState(),

      updateConfig: (patch) => set((state) => ({ config: { ...state.config, ...patch } })),

      addGroup: (input) => {
        const id = generateId('grp')
        set((state) => ({
          groups: [
            ...state.groups,
            {
              id,
              name: input.name,
              description: input.description ?? '',
              style: input.style ?? 'inherit',
              sort: state.groups.length,
              hidden: input.hidden ?? false,
              collapsed: input.collapsed ?? false,
            },
          ],
        }))
        return id
      },

      updateGroup: (id, patch) =>
        set((state) => ({
          groups: state.groups.map((group) => (group.id === id ? { ...group, ...patch } : group)),
        })),

      removeGroup: (id) =>
        set((state) => ({
          groups: normalizeGroups(state.groups.filter((group) => group.id !== id)),
          items: state.items.filter((item) => item.groupId !== id),
        })),

      moveGroup: (id, direction) => {
        const groups = normalizeGroups(get().groups)
        const index = groups.findIndex((group) => group.id === id)
        const target = index + direction
        if (index < 0 || target < 0 || target >= groups.length) return
        const next = [...groups]
        const [moved] = next.splice(index, 1)
        next.splice(target, 0, moved)
        set({ groups: next.map((group, order) => ({ ...group, sort: order })) })
      },

      reorderGroups: (ids) => {
        const groups = get().groups
        const ordered = ids
          .map((id) => groups.find((group) => group.id === id))
          .filter((group): group is NavGroup => Boolean(group))
        const rest = groups.filter((group) => !ids.includes(group.id))
        set({ groups: [...ordered, ...rest].map((group, index) => ({ ...group, sort: index })) })
      },

      addItem: (input) => {
        const id = generateId('item')
        set((state) => ({
          items: [
            ...state.items,
            {
              id,
              groupId: input.groupId,
              title: input.title,
              description: input.description ?? '',
              url: input.url ?? '',
              lanUrl: input.lanUrl ?? '',
              icon: input.icon ?? '',
              iconColor: input.iconColor ?? '',
              badge: input.badge ?? '',
              openMode: input.openMode ?? state.config.defaultOpenMode,
              hidden: input.hidden ?? false,
              sort: itemNextSort(state.items, input.groupId),
              createdAt: Date.now(),
            },
          ],
        }))
        return id
      },

      updateItem: (id, patch) =>
        set((state) => {
          const existing = state.items.find((item) => item.id === id)
          if (!existing) return {}
          const nextGroupId = patch.groupId ?? existing.groupId
          const groupChanged = nextGroupId !== existing.groupId
          let items = state.items.map((item) =>
            item.id === id
              ? {
                  ...item,
                  ...patch,
                  sort: groupChanged ? itemNextSort(state.items.filter((entry) => entry.id !== id), nextGroupId) : item.sort,
                }
              : item,
          )
          if (groupChanged) {
            const oldGroupItems = normalizeGroupItems(items, existing.groupId)
            const oldGroupMap = new Map(oldGroupItems.map((item) => [item.id, item]))
            items = items.map((item) => oldGroupMap.get(item.id) ?? item)
          }
          return { items }
        }),

      removeItem: (id) =>
        set((state) => {
          const item = state.items.find((entry) => entry.id === id)
          if (!item) return {}
          const items = state.items.filter((entry) => entry.id !== id)
          const normalized = normalizeGroupItems(items, item.groupId)
          const map = new Map(normalized.map((entry) => [entry.id, entry]))
          return { items: items.map((entry) => map.get(entry.id) ?? entry) }
        }),

      duplicateItem: (id) => {
        const state = get()
        const source = state.items.find((item) => item.id === id)
        if (!source) return
        const newItem: NavItem = {
          ...source,
          id: generateId('item'),
          title: `${source.title} 副本`,
          sort: itemNextSort(state.items, source.groupId),
          createdAt: Date.now(),
        }
        set({ items: [...state.items, newItem] })
      },

      moveItem: (id, targetGroupId, targetIndex) =>
        set((state) => {
          const active = state.items.find((item) => item.id === id)
          if (!active) return {}
          const sourceGroupId = active.groupId
          const targetItems = state.items
            .filter((item) => item.groupId === targetGroupId && item.id !== id)
            .sort((a, b) => a.sort - b.sort)
          const index = Math.max(0, Math.min(targetIndex, targetItems.length))
          targetItems.splice(index, 0, { ...active, groupId: targetGroupId })

          const updates = new Map<string, NavItem>()
          targetItems.forEach((item, order) => {
            updates.set(item.id, { ...item, groupId: targetGroupId, sort: order })
          })

          if (sourceGroupId !== targetGroupId) {
            const sourceItems = state.items
              .filter((item) => item.groupId === sourceGroupId && item.id !== id)
              .sort((a, b) => a.sort - b.sort)
            sourceItems.forEach((item, order) => {
              updates.set(item.id, { ...item, sort: order })
            })
          }

          return {
            items: state.items.map((item) => updates.get(item.id) ?? item),
          }
        }),

      addSearchEngine: (input) => {
        const id = generateId('engine')
        set((state) => ({
          searchEngines: [
            ...state.searchEngines,
            { ...input, id, sort: state.searchEngines.length },
          ],
        }))
        return id
      },

      updateSearchEngine: (id, patch) =>
        set((state) => ({
          searchEngines: state.searchEngines.map((engine) =>
            engine.id === id ? { ...engine, ...patch } : engine,
          ),
        })),

      removeSearchEngine: (id) =>
        set((state) => {
          if (state.searchEngines.length <= 1) return {}
          const searchEngines = state.searchEngines
            .filter((engine) => engine.id !== id)
            .map((engine, index) => ({ ...engine, sort: index }))
          return {
            searchEngines,
            config: {
              ...state.config,
              defaultEngineId:
                state.config.defaultEngineId === id
                  ? searchEngines[0]?.id ?? ''
                  : state.config.defaultEngineId,
            },
          }
        }),

      moveSearchEngine: (id, direction) =>
        set((state) => {
          const engines = [...state.searchEngines].sort((a, b) => a.sort - b.sort)
          const index = engines.findIndex((engine) => engine.id === id)
          const target = index + direction
          if (index < 0 || target < 0 || target >= engines.length) return {}
          const [moved] = engines.splice(index, 1)
          engines.splice(target, 0, moved)
          return { searchEngines: engines.map((engine, order) => ({ ...engine, sort: order })) }
        }),

      addGalleryAssets: (assets) => {
        const created = assets.map((asset) => ({
          ...asset,
          id: generateId('asset'),
          createdAt: Date.now(),
        }))
        set((state) => ({ gallery: [...created, ...state.gallery] }))
        return created
      },

      removeGalleryAsset: (id) =>
        set((state) => {
          const items = state.items.map((item) =>
            item.icon === `gallery:${id}` ? { ...item, icon: '' } : item,
          )
          const config = { ...state.config }
          if (config.wallpaper.type === 'gallery' && config.wallpaper.assetId === id) {
            config.wallpaper = { type: 'preset', presetId: 'nebula' }
          }
          if (config.adminAvatar === `gallery:${id}`) {
            config.adminAvatar = ''
          }
          return {
            gallery: state.gallery.filter((asset) => asset.id !== id),
            items,
            config,
          }
        }),

      importData: (data) =>
        set(() => {
          const groups = normalizeGroups(data.groups ?? [])
          const groupIds = new Set(groups.map((group) => group.id))
          const items = (data.items ?? [])
            .filter((item) => groupIds.has(item.groupId))
            .map((item) => normalizeItem(item))
          return {
            config: normalizeConfig({ ...createInitialState().config, ...data.config }),
            groups,
            items,
            searchEngines: (data.searchEngines ?? []).map((engine, index) => ({
              ...engine,
              sort: engine.sort ?? index,
            })),
            gallery: data.gallery ?? [],
          }
        }),

      resetToDemo: () => set(createInitialState()),

      /** Replaces the whole data set with the state fetched from the server. */
      applyRemoteState: (data) =>
        set(() => {
          const groups = normalizeGroups((data.groups ?? []).map((group) => ({ ...group })))
          const groupIds = new Set(groups.map((group) => group.id))
          const items = (data.items ?? [])
            .filter((item) => groupIds.has(item.groupId))
            .map((item) => normalizeItem(item))
          return {
            config: normalizeConfig({ ...createInitialState().config, ...data.config }),
            groups,
            items,
            searchEngines: (data.searchEngines ?? []).map((engine, index) => ({
              ...engine,
              sort: engine.sort ?? index,
            })),
            gallery: (data.gallery ?? []).map((asset) => ({ ...asset })),
          }
        }),
}))

export function getAppData(): AppData {
  const state = useAppStore.getState()
  return {
    config: state.config,
    groups: state.groups,
    items: state.items,
    searchEngines: state.searchEngines,
    gallery: state.gallery,
  }
}
