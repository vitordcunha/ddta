export type ProjectStatus = 'draft' | 'created' | 'uploading' | 'processing' | 'completed' | 'failed'

export type ProjectAssets = {
  orthophotoUrl?: string
  dsmUrl?: string
  dtmUrl?: string
  reportUrl?: string
}

export type FlightPlan = {
  id: string
  name: string
  plannerData?: unknown
}

export type Project = {
  id: string
  name: string
  description: string
  status: ProjectStatus
  createdAt: string
  updatedAt: string
  flightPlan: FlightPlan | null
  imageCount: number
  assets: ProjectAssets | null
}

export type CreateProjectData = {
  name: string
  description?: string
}
