import { create } from 'zustand'

export type ActivePanel = 'projects' | 'plan' | 'upload' | 'results' | 'settings' | null

type WorkspaceStore = {
  activePanel: ActivePanel
  activeProjectId: string | null
  setActivePanel: (panel: ActivePanel) => void
  setActiveProjectId: (id: string | null) => void
  togglePanel: (panel: NonNullable<ActivePanel>) => void
  openProjectPlan: (projectId: string) => void
}

export const useWorkspaceStore = create<WorkspaceStore>((set) => ({
  activePanel: 'projects',
  activeProjectId: null,
  setActivePanel: (panel) => set({ activePanel: panel }),
  setActiveProjectId: (id) => set({ activeProjectId: id }),
  togglePanel: (panel) =>
    set((state) => ({
      activePanel: state.activePanel === panel ? null : panel,
    })),
  openProjectPlan: (projectId) =>
    set({
      activeProjectId: projectId,
      activePanel: 'plan',
    }),
}))
