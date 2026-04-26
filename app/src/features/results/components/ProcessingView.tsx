import { useEffect, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button, Card } from '@/components/ui'
import type { ProcessingLogEntry } from '@/features/results/types'

interface ProcessingViewProps {
  progress: number
  message: string
  eta: string
  logs: ProcessingLogEntry[]
  onCancel: () => void
  previewStatus?: string | null
  previewProgress?: number
  sparseCloudAvailable?: boolean
  sparseCloudTrackProgress?: number
  sparseCloudTrackHint?: string
  /** Reenfileira COG + copia de resultados se o worker travou apos o ODM (~95%). */
  onFinalizeStuckMain?: () => void
  onFinalizeStuckPreview?: () => void
}

export function ProcessingView({
  progress,
  message,
  eta,
  logs,
  onCancel,
  previewStatus,
  previewProgress = 0,
  sparseCloudAvailable = false,
  sparseCloudTrackProgress = 0,
  sparseCloudTrackHint = '',
  onFinalizeStuckMain,
  onFinalizeStuckPreview,
}: ProcessingViewProps) {
  const logContainerRef = useRef<HTMLDivElement>(null)

  // Rola para a entrada mais recente sempre que novos logs chegam
  useEffect(() => {
    const el = logContainerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [logs])

  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative h-10 w-10 rounded-full border border-primary-500/60">
          <span className="absolute inset-0 animate-ping rounded-full border border-primary-500/30" />
          <span className="absolute inset-2 rounded-full bg-primary-500/50" />
        </div>
        <div>
          <p className="text-sm font-medium text-neutral-100">{message}</p>
          <p className="text-xs text-neutral-400">Tempo restante estimado: {eta}</p>
        </div>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-neutral-800">
        <div className="h-full rounded-full bg-primary-500 transition-[width] duration-500" style={{ width: `${progress}%` }} />
      </div>
      <p className="text-sm text-neutral-300">{progress}%</p>

      {previewStatus && previewStatus !== 'completed' && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span>Preview (baixa resolução)</span>
            <span>{previewProgress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-neutral-800">
            <div
              className="h-full rounded-full bg-amber-500 transition-[width] duration-500"
              style={{ width: `${previewProgress}%` }}
            />
          </div>
        </div>
      )}

      {previewStatus === 'completed' && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          Preview disponivel no mapa (baixa resolucao)
        </div>
      )}

      <div className="space-y-1 rounded-lg border border-neutral-800 bg-neutral-950/80 px-3 py-2">
        <div className="flex items-center justify-between text-xs text-neutral-400">
          <span>Nuvem esparsa (SfM)</span>
          <span>{sparseCloudAvailable ? '100%' : `${sparseCloudTrackProgress}%`}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-neutral-800">
          <div
            className={`h-full rounded-full transition-[width] duration-500 ${
              sparseCloudAvailable ? 'bg-emerald-500' : 'bg-sky-600/90'
            }`}
            style={{ width: `${sparseCloudAvailable ? 100 : sparseCloudTrackProgress}%` }}
          />
        </div>
        {sparseCloudTrackHint ? (
          <p className="text-[11px] leading-snug text-neutral-500">{sparseCloudTrackHint}</p>
        ) : null}
        {sparseCloudAvailable ? (
          <p className="text-[11px] font-medium text-emerald-400/90">
            Ative a camada &quot;Nuvem esparsa&quot; no mapa para visualizar.
          </p>
        ) : null}
      </div>

      <details className="rounded-lg border border-neutral-800 bg-neutral-950 p-3" open>
        <summary className="cursor-pointer text-sm text-neutral-200">Ver log detalhado</summary>
        <div
          ref={logContainerRef}
          className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-neutral-400"
        >
          {logs.map((log, index) => (
            <p key={`${log.timestamp}-${index}`} className={index === logs.length - 1 ? 'text-primary-300' : ''}>
              [{log.timestamp}] {log.message}
            </p>
          ))}
        </div>
      </details>

      {progress >= 90 && onFinalizeStuckMain ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-neutral-300">
          <p className="mb-2">
            Se o progresso parou perto de 95% mas o processamento no servidor ja terminou (ex.: falha ao gerar COG), voce pode
            retomar apenas a etapa final sem reprocessar o ODM.
          </p>
          <Button variant="secondary" className="w-full" onClick={() => void onFinalizeStuckMain()}>
            Retomar finalizacao (COG e resultados)
          </Button>
        </div>
      ) : null}

      {previewStatus === 'processing' && previewProgress >= 90 && onFinalizeStuckPreview ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-neutral-300">
          <p className="mb-2">Preview preso na etapa final? Reenfileire COG e organizacao dos ficheiros do preview.</p>
          <Button variant="secondary" className="w-full" onClick={() => void onFinalizeStuckPreview()}>
            Retomar finalizacao do preview
          </Button>
        </div>
      ) : null}

      <Button variant="danger" onClick={onCancel}>
        <AlertTriangle className="mr-2 h-4 w-4" />
        Cancelar processamento
      </Button>
    </Card>
  )
}
