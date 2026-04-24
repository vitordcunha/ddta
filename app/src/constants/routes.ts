export const ROUTES = {
  ROOT: "/",
  DASHBOARD: "/dashboard",
  PROJECT_NEW: "/projects/new",
  PROJECT_DETAIL: "/projects/:id",
  PROJECT_PLAN: "/projects/:id/plan",
  PROJECT_UPLOAD: "/projects/:id/upload",
  PROJECT_RESULTS: "/projects/:id/results",
  SETTINGS: "/settings",
} as const

export const WORKSPACE_ROOT = "/"

export type WorkspacePanelId =
  | "projects"
  | "plan"
  | "upload"
  | "results"
  | "settings"

const VALID_PANELS = new Set<WorkspacePanelId>([
  "projects",
  "plan",
  "upload",
  "results",
  "settings",
])

export function isWorkspacePanelId(
  value: string | null,
): value is WorkspacePanelId {
  return value !== null && VALID_PANELS.has(value as WorkspacePanelId)
}

export function parseWorkspacePanel(
  value: string | null,
): WorkspacePanelId {
  if (isWorkspacePanelId(value)) return value
  return "projects"
}

type WorkspaceQuery = {
  panel?: WorkspacePanelId
  project?: string | null
}

export function buildWorkspaceSearch(overrides: WorkspaceQuery = {}) {
  const next = new URLSearchParams()
  if (overrides.panel) next.set("panel", overrides.panel)
  if (overrides.project) next.set("project", overrides.project)
  if (overrides.project === null && next.has("project")) {
    next.delete("project")
  }
  return next
}

export function toWorkspace(
  path: string,
  { panel, project }: { panel?: WorkspacePanelId; project?: string | null } = {},
) {
  const q = new URLSearchParams(
    path.includes("?") ? path.split("?")[1] : undefined,
  )
  if (panel) q.set("panel", panel)
  if (project !== undefined) {
    if (project) q.set("project", project)
    else q.delete("project")
  }
  const base = path.split("?")[0] || WORKSPACE_ROOT
  const s = q.toString()
  return s ? `${base}?${s}` : base
}
