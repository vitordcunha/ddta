import { useCallback, useMemo, useRef, useState } from 'react'
import type { FileQueueItem } from '@/features/upload/types/upload'

type UploadUpdater = (id: string, patch: Partial<FileQueueItem>) => void

interface UseUploadOptions {
  files: FileQueueItem[]
  updateFile: UploadUpdater
  maxConcurrent?: number
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function useUpload({ files, updateFile, maxConcurrent = 3 }: UseUploadOptions) {
  const [isUploading, setIsUploading] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const abortRef = useRef(false)

  const uploadSingle = useCallback(
    async (file: FileQueueItem) => {
      updateFile(file.id, { status: 'uploading', progress: 0, errorMessage: undefined })
      const steps = 30

      for (let step = 1; step <= steps; step += 1) {
        if (abortRef.current) {
          updateFile(file.id, { status: 'pending', progress: 0 })
          return
        }
        await wait(100)
        updateFile(file.id, { progress: Math.round((step / steps) * 100) })
      }

      if (abortRef.current) {
        updateFile(file.id, { status: 'pending', progress: 0 })
        return
      }

      updateFile(file.id, { status: 'done', progress: 100 })
    },
    [updateFile],
  )

  const uploadAll = useCallback(async () => {
    if (isUploading) return
    const queue = files.filter((item) => item.status !== 'done')
    if (!queue.length) return

    setIsUploading(true)
    setIsCancelling(false)
    abortRef.current = false

    const workers = Array.from({ length: Math.min(maxConcurrent, queue.length) }, (_, workerIndex) =>
      (async () => {
        for (let i = workerIndex; i < queue.length; i += Math.min(maxConcurrent, queue.length)) {
          if (abortRef.current) return
          await uploadSingle(queue[i])
        }
      })(),
    )

    await Promise.all(workers)
    setIsUploading(false)
    setIsCancelling(false)
    abortRef.current = false
  }, [files, isUploading, maxConcurrent, uploadSingle])

  const cancelAll = useCallback(() => {
    if (!isUploading) return
    abortRef.current = true
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
