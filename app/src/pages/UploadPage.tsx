import { useMemo } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { GpsWarningBanner } from '@/features/upload/components/GpsWarningBanner'
import { ImageDropzone } from '@/features/upload/components/ImageDropzone'
import { UploadActionBar } from '@/features/upload/components/UploadActionBar'
import { UploadProgressList } from '@/features/upload/components/UploadProgressList'
import { useFileQueue } from '@/features/upload/hooks/useFileQueue'
import { useUpload } from '@/features/upload/hooks/useUpload'

export function UploadPage() {
  const { files, addFiles, updateFile, removeFile, clearDone, stats } = useFileQueue()
  const { uploadAll, cancelAll, isUploading, isCancelling, globalProgress } = useUpload({
    files,
    updateFile,
  })

  const totalBytes = useMemo(() => files.reduce((sum, item) => sum + item.file.size, 0), [files])
  const isCompleted = stats.total > 0 && stats.done === stats.total

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 pb-36 md:pb-4">
      <ImageDropzone onFilesSelected={addFiles} />
      <GpsWarningBanner files={files} />

      {files.length ? (
        <UploadProgressList
          files={files}
          stats={stats}
          totalBytes={totalBytes}
          progress={globalProgress}
          isUploading={isUploading}
          isCancelling={isCancelling}
          onRemove={removeFile}
          onUploadAll={() => void uploadAll()}
          onCancelAll={cancelAll}
        />
      ) : (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-8 text-center text-sm text-neutral-400">
          Nenhuma imagem adicionada. Arraste arquivos para iniciar o upload.
        </div>
      )}

      {isCompleted ? (
        <div className="rounded-xl border border-accent-500/40 bg-accent-500/10 p-4">
          <div className="mb-3 flex items-center gap-2 text-accent-100">
            <CheckCircle2 className="h-4 w-4" />
            Upload concluido com sucesso.
          </div>
          <Button>Iniciar processamento →</Button>
        </div>
      ) : null}

      <UploadActionBar
        total={stats.total}
        disabled={isUploading || !stats.total}
        isUploading={isUploading}
        onUpload={() => void uploadAll()}
        onClear={clearDone}
      />
    </div>
  )
}
