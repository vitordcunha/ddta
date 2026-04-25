import { useCallback, useMemo, useState } from 'react'
import { hasGpsData, generateThumbnail } from '@/features/upload/utils/exifReader'
import { generateFileId } from '@/features/upload/utils/uploadHelpers'
import type { FileQueueItem, FileQueueStats, UploadStatus } from '@/features/upload/types/upload'

function updateItem(
  items: FileQueueItem[],
  id: string,
  updater: (item: FileQueueItem) => FileQueueItem,
): FileQueueItem[] {
  return items.map((item) => (item.id === id ? updater(item) : item))
}

function serverRowFromApi(img: { id: string; filename: string; has_gps: boolean }): FileQueueItem {
  return {
    id: img.id,
    serverImageId: img.id,
    file: new File([], img.filename, { type: 'image/jpeg' }),
    status: 'done',
    progress: 100,
    hasGps: img.has_gps,
    thumbnail: null,
  }
}

export function useFileQueue() {
  const [files, setFiles] = useState<FileQueueItem[]>([])

  const resetFiles = useCallback(() => {
    setFiles([])
  }, [])

  /** Substitui linhas vindas do servidor e mantém ficheiros locais ainda nao persistidos. */
  const applyServerImageList = useCallback(
    (apiImages: { id: string; filename: string; has_gps: boolean }[]) => {
      setFiles((prev) => {
        const localOnly = prev.filter((p) => p.serverImageId == null)
        return [...apiImages.map(serverRowFromApi), ...localOnly]
      })
    },
    [],
  )

  const updateFile = useCallback((id: string, patch: Partial<FileQueueItem>) => {
    setFiles((prev) => updateItem(prev, id, (item) => ({ ...item, ...patch })))
  }, [])

  const setStatus = useCallback(
    (id: string, status: UploadStatus, patch?: Partial<FileQueueItem>) => {
      updateFile(id, { status, ...patch })
    },
    [updateFile],
  )

  const addFiles = useCallback(
    (fileList: FileList | File[]) => {
      const incoming = Array.from(fileList)
      if (!incoming.length) return

      const items = incoming.map<FileQueueItem>((file) => ({
        id: generateFileId(),
        file,
        status: 'pending',
        progress: 0,
        hasGps: null,
        thumbnail: null,
      }))

      setFiles((prev) => [...prev, ...items])

      items.forEach((item) => {
        setStatus(item.id, 'reading')
        void Promise.all([hasGpsData(item.file), generateThumbnail(item.file, 80)])
          .then(([hasGps, thumbnail]) => {
            setFiles((prev) =>
              updateItem(prev, item.id, (current) => ({
                ...current,
                hasGps,
                thumbnail: thumbnail || null,
                status: current.status === 'reading' ? 'pending' : current.status,
              })),
            )
          })
          .catch(() => {
            setFiles((prev) =>
              updateItem(prev, item.id, (current) => ({
                ...current,
                hasGps: false,
                status: current.status === 'reading' ? 'error' : current.status,
                errorMessage: 'Nao foi possivel ler EXIF desta imagem.',
              })),
            )
          })
      })
    },
    [setStatus],
  )

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((item) => item.id !== id || item.status === 'uploading'))
  }, [])

  const clearDone = useCallback(() => {
    setFiles((prev) => prev.filter((item) => item.status !== 'done'))
  }, [])

  const resetQueueForRetry = useCallback(() => {
    setFiles((prev) =>
      prev.map((item) => ({
        ...item,
        status: item.status === 'reading' ? 'reading' : 'pending',
        progress: 0,
        errorMessage: undefined,
      })),
    )
  }, [])

  const stats = useMemo<FileQueueStats>(() => {
    return files.reduce<FileQueueStats>(
      (acc, file) => {
        acc.total += 1
        if (file.status === 'pending' || file.status === 'reading') acc.pending += 1
        if (file.status === 'uploading') acc.uploading += 1
        if (file.status === 'done') acc.done += 1
        if (file.status === 'error') acc.error += 1
        if (file.hasGps === true) acc.withGps += 1
        if (file.hasGps === false) acc.withoutGps += 1
        return acc
      },
      { total: 0, pending: 0, uploading: 0, done: 0, error: 0, withGps: 0, withoutGps: 0 },
    )
  }, [files])

  return {
    files,
    addFiles,
    updateFile,
    removeFile,
    clearDone,
    resetQueueForRetry,
    resetFiles,
    applyServerImageList,
    stats,
  }
}
