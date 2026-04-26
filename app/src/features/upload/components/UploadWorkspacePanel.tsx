import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2 } from 'lucide-react'
import { GpsWarningBanner } from '@/features/upload/components/GpsWarningBanner'
import { ImageDropzone } from '@/features/upload/components/ImageDropzone'
import { UploadActionBar } from '@/features/upload/components/UploadActionBar'
import { UploadProgressList } from '@/features/upload/components/UploadProgressList'
import { useFileQueue } from '@/features/upload/hooks/useFileQueue'
import { useUpload } from '@/features/upload/hooks/useUpload'
import { Card } from '@/components/ui'
import { projectsService } from '@/services/projectsService'

type UploadWorkspacePanelProps = {
  projectId: string | null
}

export function UploadWorkspacePanel({ projectId }: UploadWorkspacePanelProps) {
  const { files, addFiles, updateFile, removeFile, clearDone, resetQueueForRetry, resetFiles, applyServerImageList, stats } =
    useFileQueue()
  const { uploadAll, cancelAll, resetUploadSession, isUploading, isCancelling, globalProgress } = useUpload({
    files,
    updateFile,
    projectId: projectId ?? undefined,
    resetQueueForRetry,
  })
  const [isReiniciarUpload, setIsReiniciarUpload] = useState(false)

  const totalBytes = useMemo(() => files.reduce((sum, item) => sum + item.file.size, 0), [files])
  const isCompleted = stats.total > 0 && stats.done === stats.total

  const handleReiniciarUpload = async () => {
    if (!projectId) return
    if (
      !window.confirm(
        'Cancela uploads em curso, remove todas as imagens deste projeto no servidor (incluindo ficheiros temporarios) e repoe a fila local como pendente. Continuar?',
      )
    ) {
      return
    }
    setIsReiniciarUpload(true)
    try {
      await resetUploadSession()
      toast.success('Upload reiniciado: servidor limpo e fila reposta.')
    } catch {
      toast.error('Nao foi possivel reiniciar o upload. Tente de novo.')
    } finally {
      setIsReiniciarUpload(false)
    }
  }
  const completionAnnounced = useRef(false)
  /** Evita toast ao abrir o painel com imagens já no servidor (todas em "done" sem upload nesta sessão). */
  const uploadStartedThisSession = useRef(false)

  useEffect(() => {
    if (isUploading) uploadStartedThisSession.current = true
  }, [isUploading])

  useEffect(() => {
    if (!projectId) {
      resetFiles()
      completionAnnounced.current = false
      uploadStartedThisSession.current = false
      return
    }
    resetFiles()
    completionAnnounced.current = false
    uploadStartedThisSession.current = false
    let cancelled = false
    void projectsService
      .listProjectImages(projectId)
      .then((images) => {
        if (cancelled) return
        applyServerImageList(images)
      })
      .catch(() => {
        if (!cancelled) toast.error('Nao foi possivel carregar as imagens ja enviadas deste projeto.')
      })
    return () => {
      cancelled = true
    }
  }, [projectId, resetFiles, applyServerImageList])

  const handleRemove = (id: string) => {
    const item = files.find((f) => f.id === id)
    void (async () => {
      if (item?.serverImageId && projectId) {
        try {
          await projectsService.deleteProjectImage(projectId, item.serverImageId)
        } catch {
          toast.error('Nao foi possivel remover a imagem no servidor.')
          return
        }
      }
      removeFile(id)
    })()
  }

  useEffect(() => {
    if (isCompleted && !completionAnnounced.current && uploadStartedThisSession.current) {
      completionAnnounced.current = true
      toast.success('Upload concluido: todas as imagens foram enviadas.')
    }
    if (!isCompleted) completionAnnounced.current = false
  }, [isCompleted])

  if (!projectId) {
    return (
      <Card className="border-dashed border-[#363636] bg-[#0f0f0f]/50 p-6 text-center">
        <p className="text-sm text-[#b4b4b4]">
          Selecione um projeto no seletor da barra superior para enviar imagens.
        </p>
      </Card>
    )
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
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
          onRemove={handleRemove}
          onUploadAll={() => void uploadAll()}
          onCancelAll={cancelAll}
        />
      ) : (
        <div className="rounded-xl border border-[#2e2e2e] bg-[#0f0f0f]/50 p-8 text-center text-sm text-[#898989]">
          Nenhuma imagem adicionada. Arraste arquivos para iniciar o upload.
        </div>
      )}

      {isCompleted ? (
        <div className="rounded-xl border border-[rgba(62,207,142,0.3)] bg-[#0f0f0f] p-4">
          <div className="mb-2 flex items-center gap-2 text-sm text-primary-200">
            <CheckCircle2 className="h-4 w-4" />
            Upload concluido com sucesso.
          </div>
        </div>
      ) : null}

      <UploadActionBar
        total={stats.total}
        disabled={isUploading || !stats.total}
        isUploading={isUploading}
        onUpload={() => void uploadAll()}
        onClear={clearDone}
        onReiniciarUpload={handleReiniciarUpload}
        isReiniciarUpload={isReiniciarUpload}
      />
    </div>
  )
}
