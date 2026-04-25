import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { ProcessingLogEntry, ProcessingPreset, ProcessingStep } from '@/features/results/types'
import { projectsService } from '@/services/projectsService'

const steps: ProcessingStep[] = [
  { progress: 0, message: 'Iniciando processamento...' },
  { progress: 15, message: 'Extraindo caracteristicas (SIFT)...' },
  { progress: 43, message: 'Correspondencia de imagens...' },
  { progress: 67, message: 'Reconstrucao 3D (SfM)...' },
  { progress: 84, message: 'Gerando ortomosaico...' },
  { progress: 95, message: 'Convertendo para COG...' },
  { progress: 100, message: 'Concluido' },
]

type RuntimeStatus = 'uploading' | 'processing' | 'completed' | 'failed'

type StreamStatusPayload = {
  status?: string
  progress?: number
  message?: string
}

/** API pode enviar `queued`; a UI trata como processamento ativo. */
function normalizeRuntimeStatus(raw: string | undefined, fallback: RuntimeStatus): RuntimeStatus {
  switch (raw) {
    case 'completed':
      return 'completed'
    case 'failed':
      return 'failed'
    case 'processing':
    case 'queued':
      return 'processing'
    case 'draft':
    case 'created':
    case 'uploading':
      return 'uploading'
    case 'cancelled':
    case 'canceled':
      return 'failed'
    default:
      return fallback
  }
}

export function useProjectStatus(projectId: string, initialStatus: RuntimeStatus) {
  const [status, setStatus] = useState<RuntimeStatus>(initialStatus)
  const [progress, setProgress] = useState(initialStatus === 'completed' ? 100 : 0)
  const [message, setMessage] = useState(initialStatus === 'completed' ? 'Concluido' : 'Aguardando')
  const [logs, setLogs] = useState<ProcessingLogEntry[]>([])
  const timerRef = useRef<number | null>(null)
  const streamRef = useRef<EventSource | null>(null)
  const statusRef = useRef<RuntimeStatus>(initialStatus)
  useEffect(() => {
    statusRef.current = status
  }, [status])

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => stopTimer, [stopTimer])

  const stopStream = useCallback(() => {
    streamRef.current?.close()
    streamRef.current = null
  }, [])

  useEffect(() => {
    setStatus(initialStatus)
    setProgress(initialStatus === 'completed' ? 100 : 0)
    setMessage(initialStatus === 'completed' ? 'Concluido' : 'Aguardando')
    setLogs([])
    stopStream()
    // Apenas ao mudar de projeto — não quando a lista de projetos refetch e `initialStatus` muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, stopStream])

  useEffect(() => () => stopStream(), [stopStream])

  const openStream = useCallback(() => {
    if (!projectId) return
    stopStream()

    const eventSource = new EventSource(projectsService.getStatusStreamUrl(projectId))
    streamRef.current = eventSource

    eventSource.onmessage = (event) => {
      const payload = JSON.parse(event.data) as StreamStatusPayload
      const incomingStatus = normalizeRuntimeStatus(payload.status, 'processing')
      const incomingProgress = Math.max(0, Math.min(100, Math.round(payload.progress ?? 0)))

      setStatus(incomingStatus)
      setProgress(incomingProgress)

      const currentStep = [...steps].reverse().find((step) => incomingProgress >= step.progress) ?? steps[0]
      const text = payload.message ?? currentStep.message
      setMessage(text)
      setLogs((prev) => {
        if (prev.some((entry) => entry.message === text)) return prev
        return [...prev, { timestamp: new Date().toLocaleTimeString('pt-BR'), message: text }]
      })

      if (incomingStatus === 'completed' || incomingStatus === 'failed') {
        stopStream()
      }
    }
  }, [projectId, stopStream])

  const startProcessing = useCallback(
    async (preset: ProcessingPreset = 'standard') => {
      if (!projectId) return
      stopTimer()
      const toRestore = statusRef.current
      setStatus('processing')
      setProgress(0)
      setMessage(steps[0].message)
      setLogs([{ timestamp: new Date().toLocaleTimeString('pt-BR'), message: steps[0].message }])
      try {
        await projectsService.startProcessing(projectId, { preset })
        openStream()
      } catch {
        setStatus(toRestore)
        if (toRestore === 'failed') {
          setMessage('Processamento com erro anterior')
        } else {
          setMessage('Aguardando processamento')
        }
        setProgress(toRestore === 'completed' ? 100 : 0)
        setLogs([])
        toast.error('Nao foi possivel iniciar o processamento. Confirme as imagens no projeto e tente de novo.')
      }
    },
    [openStream, projectId, stopTimer],
  )

  const cancelProcessing = useCallback(async () => {
    if (!projectId) return
    stopTimer()
    stopStream()
    await projectsService.cancelProcessing(projectId)
    setStatus('failed')
    setMessage('Processamento cancelado')
  }, [projectId, stopStream, stopTimer])

  useEffect(() => {
    if (!projectId) return
    if (status === 'processing') {
      openStream()
    }
  }, [openStream, projectId, status])

  const eta = useMemo(() => {
    if (status !== 'processing') return 'n/a'
    const remaining = Math.max(0, 100 - progress)
    const minutes = Math.max(1, Math.round(remaining * 0.9))
    return `${minutes} min`
  }, [progress, status])

  return {
    status,
    progress,
    message,
    eta,
    logs,
    startProcessing,
    cancelProcessing,
  }
}
