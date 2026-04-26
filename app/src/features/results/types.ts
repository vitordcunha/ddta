export type ResultLayerId = 'orthophoto' | 'dsm' | 'dtm' | 'contours' | 'sparse'

export type ProcessingPreset = 'fast' | 'standard' | 'ultra'

export interface ProcessingStep {
  progress: number
  message: string
}

export interface ProcessingLogEntry {
  timestamp: string
  message: string
}

export interface PreviewStatus {
  previewStatus: 'queued' | 'processing' | 'completed' | 'failed' | null
  previewProgress: number
  previewAssets: Record<string, string> | null
  sparseCloudAvailable: boolean
}

export interface CompletedProjectStats {
  gsdCmPx: number
  areaHa: number
  imageCount: number
  pointCount: number
  orthophotoResolutionCmPx: number
  processingTimeMinutes: number
}
