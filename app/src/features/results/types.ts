export type ResultLayerId = 'orthophoto' | 'dsm' | 'dtm' | 'contours'

export type ProcessingPreset = 'fast' | 'standard' | 'ultra'

export interface ProcessingStep {
  progress: number
  message: string
}

export interface ProcessingLogEntry {
  timestamp: string
  message: string
}

export interface CompletedProjectStats {
  gsdCmPx: number
  areaHa: number
  imageCount: number
  pointCount: number
  orthophotoResolutionCmPx: number
  processingTimeMinutes: number
}
