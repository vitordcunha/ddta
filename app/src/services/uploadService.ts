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

function serverImageIdFromResponse(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null) return undefined
  const o = data as { complete?: boolean; id?: unknown }
  if (o.complete === false) return undefined
  return typeof o.id === 'string' ? o.id : undefined
}

async function uploadChunk(params: UploadChunkParams): Promise<unknown> {
  const formData = new FormData()
  formData.append('chunk', params.chunk, `${params.file.name}.part-${params.chunkIndex}`)
  formData.append('file_id', params.fileId)
  formData.append('filename', params.file.name)
  formData.append('chunk_index', String(params.chunkIndex))
  formData.append('total_chunks', String(params.totalChunks))

  const { data } = await http.post<unknown>(`/projects/${params.projectId}/images/upload-chunk`, formData, {
    signal: params.signal,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return data
}

async function uploadChunkWithRetry(params: UploadChunkParams): Promise<unknown> {
  let attempt = 0
  while (attempt < MAX_RETRIES) {
    try {
      return await uploadChunk(params)
    } catch (error) {
      attempt += 1
      if (params.signal?.aborted || attempt >= MAX_RETRIES) {
        throw error
      }
    }
  }
  throw new Error('Falha apos retentativas de upload de chunk.')
}

/** Devolve o `id` da `ProjectImage` no servidor após o último chunk ser aceite. */
export async function uploadFileInChunks({ projectId, fileId, file, onProgress, signal }: UploadInChunksParams): Promise<string | undefined> {
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

  // Backend assembles when chunk_index === total_chunks - 1; that request must run only after
  // all other chunk files exist on disk, so the last chunk is never uploaded in parallel with risk
  // of finishing before earlier chunks.
  if (totalChunks === 1) {
    const data = await uploadChunkWithRetry({
      projectId,
      fileId,
      file,
      chunk: chunks[0].chunk,
      chunkIndex: 0,
      totalChunks,
      signal,
    })
    markProgress(0)
    return serverImageIdFromResponse(data)
  }

  const nonLast = chunks.slice(0, -1)
  const stride = Math.min(MAX_CHUNK_CONCURRENCY, nonLast.length)

  const workers = Array.from({ length: Math.min(MAX_CHUNK_CONCURRENCY, nonLast.length) }, (_, workerIndex) =>
    (async () => {
      for (let i = workerIndex; i < nonLast.length; i += stride) {
        const { chunkIndex, chunk } = nonLast[i]
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

  const last = chunks[totalChunks - 1]
  const data = await uploadChunkWithRetry({
    projectId,
    fileId,
    file,
    chunk: last.chunk,
    chunkIndex: last.chunkIndex,
    totalChunks,
    signal,
  })
  markProgress(last.chunkIndex)
  return serverImageIdFromResponse(data)
}
