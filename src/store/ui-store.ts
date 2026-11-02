import { create } from 'zustand'

export type SettingsTab =
  | 'site'
  | 'profile'
  | 'appearance'
  | 'search'
  | 'content'
  | 'media'
  | 'cloud'
  | 'backup'
  | 'about'

interface UiState {
  editMode: boolean
  settingsOpen: boolean
  settingsTab: SettingsTab
  galleryOpen: boolean
  groupDialogOpen: boolean
  editingGroupId: string | null
  itemDialogOpen: boolean
  editingItemId: string | null
  itemDialogGroupId: string | null
  setEditMode: (value: boolean) => void
  toggleEditMode: () => void
  openSettings: (tab?: SettingsTab) => void
  closeSettings: () => void
  setSettingsTab: (tab: SettingsTab) => void
  openGallery: () => void
  closeGallery: () => void
  openGroupDialog: (groupId?: string | null) => void
  closeGroupDialog: () => void
  openAddItem: (groupId: string) => void
  openEditItem: (itemId: string) => void
  closeItemDialog: () => void
}

export const useUiStore = create<UiState>((set) => ({
  editMode: false,
  settingsOpen: false,
  settingsTab: 'site',
  galleryOpen: false,
  groupDialogOpen: false,
  editingGroupId: null,
  itemDialogOpen: false,
  editingItemId: null,
  itemDialogGroupId: null,
  setEditMode: (value) => set({ editMode: value }),
  toggleEditMode: () => set((state) => ({ editMode: !state.editMode })),
  openSettings: (tab) =>
    set((state) => ({
      settingsOpen: true,
      settingsTab: tab ?? state.settingsTab,
    })),
  closeSettings: () => set({ settingsOpen: false }),
  setSettingsTab: (tab) => set({ settingsTab: tab }),
  openGallery: () => set({ galleryOpen: true }),
  closeGallery: () => set({ galleryOpen: false }),
  openGroupDialog: (groupId = null) => set({ groupDialogOpen: true, editingGroupId: groupId }),
  closeGroupDialog: () => set({ groupDialogOpen: false, editingGroupId: null }),
  openAddItem: (groupId) =>
    set({ itemDialogOpen: true, editingItemId: null, itemDialogGroupId: groupId }),
  openEditItem: (itemId) =>
    set({ itemDialogOpen: true, editingItemId: itemId, itemDialogGroupId: null }),
  closeItemDialog: () =>
    set({ itemDialogOpen: false, editingItemId: null, itemDialogGroupId: null }),
}))
