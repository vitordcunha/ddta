import { http } from '@/services/http'

export const CHUNK_SIZE = 5 * 1024 * 1024
const MAX_RETRIES = 3
const MAX_CHUNK_CONCURRENCY = 3

type UploadChunkParams = {
  projectId: string
  fileId: string
  file: File
  chunk: Blob
  chunkIndex: number
  totalChunks: number
  signal?: AbortSignal
}

type UploadInChunksParams = {
  projectId: string
  fileId: string
  file: File
  onProgress?: (progress: number) => void
  signal?: AbortSignal
}

async function uploadChunk(params: UploadChunkParams): Promise<void> {
  const formData = new FormData()
  formData.append('chunk', params.chunk, `${params.file.name}.part-${params.chunkIndex}`)
  formData.append('file_id', params.fileId)
  formData.append('file_name', params.file.name)
  formData.append('mime_type', params.file.type || 'application/octet-stream')
  formData.append('chunk_index', String(params.chunkIndex))
  formData.append('total_chunks', String(params.totalChunks))

  await http.post(`/projects/${params.projectId}/images/upload-chunk`, formData, {
    signal: params.signal,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
}

async function uploadChunkWithRetry(params: UploadChunkParams): Promise<void> {
  let attempt = 0
  while (attempt < MAX_RETRIES) {
    try {
      await uploadChunk(params)
      return
    } catch (error) {
      attempt += 1
      if (params.signal?.aborted || attempt >= MAX_RETRIES) {
        throw error
      }
    }
  }
}

export async function uploadFileInChunks({ projectId, fileId, file, onProgress, signal }: UploadInChunksParams): Promise<void> {
  const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE))
  const uploaded = new Set<number>()

  const markProgress = (chunkIndex: number) => {
    uploaded.add(chunkIndex)
    onProgress?.(Math.round((uploaded.size / totalChunks) * 100))
  }

  const chunks = Array.from({ length: totalChunks }, (_, chunkIndex) => {
    const start = chunkIndex * CHUNK_SIZE
    const end = Math.min(file.size, start + CHUNK_SIZE)
    const chunk = file.slice(start, end)
    return { chunkIndex, chunk }
  })

  const workers = Array.from({ length: Math.min(MAX_CHUNK_CONCURRENCY, chunks.length) }, (_, workerIndex) =>
    (async () => {
      for (let i = workerIndex; i < chunks.length; i += Math.min(MAX_CHUNK_CONCURRENCY, chunks.length)) {
        const { chunkIndex, chunk } = chunks[i]
        await uploadChunkWithRetry({
          projectId,
          fileId,
          file,
          chunk,
          chunkIndex,
          totalChunks,
          signal,
        })
        markProgress(chunkIndex)
      }
    })(),
  )

  await Promise.all(workers)
}
