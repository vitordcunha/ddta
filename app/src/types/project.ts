/// <reference types="geojson" />

export type ProjectStatus =
  | 'draft'
  | 'created'
  | 'uploading'
  | 'queued'
  | 'processing'
  | 'sparse_processing'
  | 'awaiting_boundary'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'canceled'

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
  /** Preset chosen when selective processing was initiated (phase-1 sparse SfM). */
  selectiveProcessingPreset: string | null
  /** GeoJSON boundary confirmed by the user for selective (phase-2) processing. */
  processingBoundary: GeoJSON.GeoJsonObject | null
}

export type CreateProjectData = {
  name: string
  description?: string
}
