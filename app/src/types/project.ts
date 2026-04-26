export type ProjectStatus = 'draft' | 'created' | 'uploading' | 'processing' | 'completed' | 'failed'

/** Chaves são caminhos relativos retornados pelo backend (ex: "odm_orthophoto/odm_orthophoto.tif"). */
export type ProjectAssets = Record<string, string>

export type ProcessingRunInfo = {
  runId: string
  preset: string
  completedAt: string
  stats: Record<string, unknown> | null
  assets: ProjectAssets
}

export type PreviewRunInfo = {
  runId: string
  kind: string
  completedAt: string
  previewAssets: ProjectAssets
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
  stats: Record<string, unknown> | null
  previewStatus: string | null
  previewProgress: number
  previewAssets: ProjectAssets | null
  processingRuns: ProcessingRunInfo[]
  previewRuns: PreviewRunInfo[]
  lastProcessingPreset: string | null
  /** True when backend has generated sparse_cloud.geojson (SfM preview). */
  sparseCloudAvailable: boolean
}

export type CreateProjectData = {
  name: string
  description?: string
}
