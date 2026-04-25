export type UploadStatus = 'pending' | 'reading' | 'uploading' | 'done' | 'error'

export interface FileQueueItem {
  id: string
  /** Quando a linha veio do servidor (GET /images), usar ao remover (DELETE) */
  serverImageId?: string
  file: File
  status: UploadStatus
  progress: number
  hasGps: boolean | null
  thumbnail: string | null
  errorMessage?: string
}

export interface FileQueueStats {
  total: number
  pending: number
  uploading: number
  done: number
  error: number
  withGps: number
  withoutGps: number
}
