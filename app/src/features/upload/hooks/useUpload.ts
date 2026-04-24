import { useCallback, useMemo, useRef, useState } from 'react'
import type { FileQueueItem } from '@/features/upload/types/upload'
import { uploadFileInChunks } from '@/services/uploadService'

type UploadUpdater = (id: string, patch: Partial<FileQueueItem>) => void

interface UseUploadOptions {
  files: FileQueueItem[]
  updateFile: UploadUpdater
  projectId?: string
  maxConcurrent?: number
}

export function useUpload({ files, updateFile, projectId, maxConcurrent = 3 }: UseUploadOptions) {
  const [isUploading, setIsUploading] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const abortRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  const uploadSingle = useCallback(
    async (file: FileQueueItem) => {
      if (!projectId) {
        updateFile(file.id, { status: 'error', errorMessage: 'Projeto invalido para upload.' })
        return
      }

      updateFile(file.id, { status: 'uploading', progress: 0, errorMessage: undefined })
      try {
        await uploadFileInChunks({
          projectId,
          fileId: file.id,
          file: file.file,
          signal: abortControllerRef.current?.signal,
          onProgress: (progress) => updateFile(file.id, { progress }),
        })

        if (abortRef.current) {
          updateFile(file.id, { status: 'pending', progress: 0 })
          return
        }

        updateFile(file.id, { status: 'done', progress: 100 })
      } catch {
        if (abortRef.current) {
          updateFile(file.id, { status: 'pending', progress: 0 })
          return
        }
        updateFile(file.id, {
          status: 'error',
          errorMessage: 'Falha no upload. Tente novamente.',
        })
      }
    },
    [projectId, updateFile],
  )

  const uploadAll = useCallback(async () => {
    if (isUploading) return
    const queue = files.filter((item) => item.status !== 'done')
    if (!queue.length) return

    setIsUploading(true)
    setIsCancelling(false)
    abortRef.current = false
    abortControllerRef.current = new AbortController()

    const workers = Array.from({ length: Math.min(maxConcurrent, queue.length) }, (_, workerIndex) =>
      (async () => {
        for (let i = workerIndex; i < queue.length; i += Math.min(maxConcurrent, queue.length)) {
          if (abortRef.current) return
          await uploadSingle(queue[i])
        }
      })(),
    )

    try {
      await Promise.all(workers)
    } finally {
      setIsUploading(false)
      setIsCancelling(false)
      abortRef.current = false
      abortControllerRef.current = null
    }
  }, [files, isUploading, maxConcurrent, uploadSingle])

  const cancelAll = useCallback(() => {
    if (!isUploading) return
    abortRef.current = true
    abortControllerRef.current?.abort()
    setIsCancelling(true)
  }, [isUploading])

  const globalProgress = useMemo(() => {
    if (!files.length) return 0
    const total = files.reduce((acc, file) => acc + file.progress, 0)
    return Math.round(total / files.length)
  }, [files])

  return {
    uploadAll,
    cancelAll,
    isUploading,
    isCancelling,
    globalProgress,
  }
}
