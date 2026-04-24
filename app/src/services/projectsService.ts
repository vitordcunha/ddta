import { http } from '@/services/http'
import type { CreateProjectData, Project } from '@/types/project'

type StartProcessingPayload = {
  preset?: 'fast' | 'standard' | 'ultra'
}

export const projectsService = {
  async getAll(): Promise<Project[]> {
    const { data } = await http.get<Project[]>('/projects')
    return data
  },

  async create(payload: CreateProjectData): Promise<Project> {
    const { data } = await http.post<Project>('/projects', payload)
    return data
  },

  async update(id: string, payload: Partial<Project>): Promise<Project> {
    const { data } = await http.patch<Project>(`/projects/${id}`, payload)
    return data
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
