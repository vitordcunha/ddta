import { http } from '@/services/http'
import type { PersistedFlightPlan } from '@/features/flight-planner/stores/useFlightStore'
import type { CreateProjectData, FlightPlan, Project, ProjectStatus } from '@/types/project'

type StartProcessingPayload = {
  preset?: 'fast' | 'standard' | 'ultra'
}

type ApiProject = {
  id: string
  name: string
  description: string
  status: string
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
  /** Snapshot completo do planejador (UI); persistido no backend. */
  planner_data?: unknown
  images?: { id: string }[]
  assets?: Project['assets'] | null
}

function toFlightPlanFromApi(p: ApiProject): FlightPlan | null {
  if (p.planner_data == null) return null
  return { id: `${p.id}-plan`, name: `Plano de ${p.name}`, plannerData: p.planner_data }
}

function normalizeProject(p: ApiProject): Project {
  return {
    id: String(p.id),
    name: p.name,
    description: p.description ?? '',
    status: p.status as ProjectStatus,
    createdAt: p.createdAt ?? p.created_at ?? '',
    updatedAt: p.updatedAt ?? p.updated_at ?? '',
    imageCount: p.images?.length ?? 0,
    assets: p.assets ?? null,
    flightPlan: toFlightPlanFromApi(p),
  }
}

function toFlightPlanSaveBody(plan: PersistedFlightPlan) {
  const pr = plan.params
  return {
    planner_data: plan as unknown as Record<string, unknown>,
    flight_area: plan.polygon ?? undefined,
    altitude_m: pr.altitudeM,
    forward_overlap: Math.round(pr.forwardOverlap),
    side_overlap: Math.round(pr.sideOverlap),
    rotation_angle: pr.rotationDeg,
    stats: plan.stats,
  }
}

export const projectsService = {
  async getAll(): Promise<Project[]> {
    const { data } = await http.get<ApiProject[]>('/projects')
    return data.map(normalizeProject)
  },

  async create(payload: CreateProjectData): Promise<Project> {
    const { data } = await http.post<ApiProject>('/projects', payload)
    return normalizeProject(data)
  },

  async update(id: string, payload: Partial<Project>): Promise<Project> {
    const { data } = await http.patch<ApiProject>(`/projects/${id}`, payload)
    return normalizeProject(data)
  },

  async saveFlightPlan(id: string, plan: PersistedFlightPlan): Promise<Project> {
    const { data } = await http.post<ApiProject>(`/projects/${id}/flightplan`, toFlightPlanSaveBody(plan))
    return normalizeProject(data)
  },

  async remove(id: string): Promise<void> {
    await http.delete(`/projects/${id}`)
  },

  async startProcessing(id: string, payload: StartProcessingPayload = {}): Promise<void> {
    await http.post(`/projects/${id}/process`, payload)
  },

  async cancelProcessing(id: string): Promise<void> {
    await http.delete(`/projects/${id}/process`)
  },

  getStatusStreamUrl(id: string): string {
    const apiBase = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1').replace(/\/$/, '')
    const workspaceId = import.meta.env.VITE_WORKSPACE_ID ?? 'default'
    const separator = apiBase.includes('?') ? '&' : '?'
    return `${apiBase}/projects/${id}/status/stream${separator}workspace_id=${encodeURIComponent(workspaceId)}`
  },
}
