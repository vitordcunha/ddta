import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
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
  preview_status?: string | null
  preview_progress?: number
  preview_assets?: Record<string, string> | null
  sparse_cloud_available?: boolean
  sparse_cloud_track_progress?: number
  sparse_cloud_track_hint?: string
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
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<RuntimeStatus>(initialStatus)
  const [progress, setProgress] = useState(initialStatus === 'completed' ? 100 : 0)
  const [message, setMessage] = useState(initialStatus === 'completed' ? 'Concluido' : 'Aguardando')
  const [logs, setLogs] = useState<ProcessingLogEntry[]>([])
  const [previewStatus, setPreviewStatus] = useState<string | null>(null)
  const [previewProgress, setPreviewProgress] = useState(0)
  const [sparseCloudAvailable, setSparseCloudAvailable] = useState(false)
  const [sparseCloudTrackProgress, setSparseCloudTrackProgress] = useState(0)
  const [sparseCloudTrackHint, setSparseCloudTrackHint] = useState('')
  const sparseSeenRef = useRef(false)
  const timerRef = useRef<number | null>(null)
  const streamRef = useRef<EventSource | null>(null)
  const statusRef = useRef<RuntimeStatus>(initialStatus)
  /** Controla pré-preenchimento de histórico na primeira mensagem de cada stream. */
  const streamInitializedRef = useRef(false)
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
    setPreviewStatus(null)
    setPreviewProgress(0)
    setSparseCloudAvailable(false)
    setSparseCloudTrackProgress(0)
    setSparseCloudTrackHint('')
    sparseSeenRef.current = false
    streamInitializedRef.current = false
    stopStream()
    // Apenas ao mudar de projeto — não quando a lista de projetos refetch e `initialStatus` muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, stopStream])

  useEffect(() => () => stopStream(), [stopStream])

  const openStream = useCallback(() => {
    if (!projectId) return
    stopStream()
    streamInitializedRef.current = false

    const eventSource = new EventSource(projectsService.getStatusStreamUrl(projectId))
    streamRef.current = eventSource

    const handleMessage = (event: MessageEvent) => {
      const payload = JSON.parse(event.data as string) as StreamStatusPayload
      const incomingStatus = normalizeRuntimeStatus(payload.status, 'processing')
      const incomingProgress = Math.max(0, Math.min(100, Math.round(payload.progress ?? 0)))

      setStatus(incomingStatus)
      setProgress(incomingProgress)
      setPreviewStatus(payload.preview_status ?? null)
      setPreviewProgress(Math.round(payload.preview_progress ?? 0))
      const sparseNow = payload.sparse_cloud_available ?? false
      setSparseCloudAvailable(sparseNow)
      setSparseCloudTrackProgress(
        Math.max(0, Math.min(100, Math.round(payload.sparse_cloud_track_progress ?? 0))),
      )
      setSparseCloudTrackHint(String(payload.sparse_cloud_track_hint ?? ''))

      if (sparseNow && !sparseSeenRef.current) {
        sparseSeenRef.current = true
        void queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      }

      const currentStep = [...steps].reverse().find((step) => incomingProgress >= step.progress) ?? steps[0]
      const text = payload.message ?? currentStep.message
      setMessage(text)

      const isTerminal = incomingStatus === 'completed' || incomingStatus === 'failed'

      // Na primeira mensagem da stream, pré-popula o histórico com todas as etapas já concluídas.
      // Isso garante que ao recarregar a página no meio de um processamento o log mostre o histórico completo.
      const isFirst = !streamInitializedRef.current
      if (isFirst) {
        streamInitializedRef.current = true
        const now = new Date().toLocaleTimeString('pt-BR')
        const pastEntries = steps
          .filter((s) => s.progress <= incomingProgress)
          .map<ProcessingLogEntry>((s) => ({ timestamp: now, message: s.message }))
        setLogs((prev) => {
          const existing = new Set(prev.map((e) => e.message))
          const toAdd = pastEntries.filter((e) => !existing.has(e.message))
          return toAdd.length > 0 ? [...prev, ...toAdd] : prev
        })
        if (isTerminal) {
          stopStream()
          void queryClient.invalidateQueries({ queryKey: ['project', projectId] })
          void queryClient.invalidateQueries({ queryKey: ['projects'] })
        }
        return
      }

      // Eventos subsequentes: adiciona nova entrada apenas quando a etapa avança.
      setLogs((prev) => {
        if (prev.some((entry) => entry.message === text)) return prev
        return [...prev, { timestamp: new Date().toLocaleTimeString('pt-BR'), message: text }]
      })

      if (isTerminal) {
        stopStream()
        void queryClient.invalidateQueries({ queryKey: ['project', projectId] })
        void queryClient.invalidateQueries({ queryKey: ['projects'] })
      }
    }

    // Backend envia eventos nomeados "status"; onmessage só recebe eventos sem nome.
    eventSource.addEventListener('status', handleMessage)
    eventSource.onerror = () => {
      // EventSource reconecta automaticamente; sem ação necessária aqui.
    }
  }, [projectId, queryClient, stopStream])

  const startProcessing = useCallback(
    async (preset: ProcessingPreset = 'standard', enablePreview = false) => {
      if (!projectId) return
      stopTimer()
      const toRestore = statusRef.current
      // Importante: só marcar como `processing` depois do POST — senão o SSE abre antes do commit no
      // servidor, recebe ainda `completed` (stream termina no primeiro evento) e a UI volta ao estado antigo.
      try {
        await projectsService.startProcessing(projectId, { preset, enable_preview: enablePreview })
        void queryClient.invalidateQueries({ queryKey: ['project', projectId] })
        void queryClient.invalidateQueries({ queryKey: ['projects'] })
        setStatus('processing')
        setProgress(0)
        setMessage(steps[0].message)
        setLogs([{ timestamp: new Date().toLocaleTimeString('pt-BR'), message: steps[0].message }])
        sparseSeenRef.current = false
        if (!enablePreview) {
          setPreviewStatus(null)
          setPreviewProgress(0)
        }
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
    [projectId, queryClient, stopStream, stopTimer],
  )

  const cancelProcessing = useCallback(async () => {
    if (!projectId) return
    stopTimer()
    stopStream()
    await projectsService.cancelProcessing(projectId)
    setStatus('failed')
    setMessage('Processamento cancelado')
  }, [projectId, stopStream, stopTimer])

  const finalizeStuckMain = useCallback(async () => {
    if (!projectId) return
    try {
      const res = await projectsService.finalizeProcessing(projectId)
      if (res.status === 'completed') {
        setStatus('completed')
        setProgress(100)
        setMessage('Concluido')
        stopStream()
        void queryClient.invalidateQueries({ queryKey: ['project', projectId] })
        void queryClient.invalidateQueries({ queryKey: ['projects'] })
        toast.success('Projeto ja estava concluido.')
        return
      }
      setStatus('processing')
      setProgress((p) => Math.max(p, 96))
      setMessage('Retomando finalizacao (COG e resultados)...')
      void queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Finalizacao reenfileirada. O progresso deve atualizar em instantes.')
    } catch (e) {
      const detail = isAxiosError(e) ? e.response?.data : undefined
      const msg =
        typeof detail === 'object' && detail !== null && 'detail' in detail && typeof (detail as { detail: unknown }).detail === 'string'
          ? (detail as { detail: string }).detail
          : 'Nao foi possivel retomar. Confirme que o ortomosaico existe no armazenamento.'
      toast.error(msg)
    }
  }, [projectId, queryClient, stopStream])

  const finalizeStuckPreview = useCallback(async () => {
    if (!projectId) return
    try {
      const res = await projectsService.finalizePreviewProcessing(projectId)
      if (res.preview_status === 'completed') {
        setPreviewStatus('completed')
        setPreviewProgress(100)
        void queryClient.invalidateQueries({ queryKey: ['project', projectId] })
        void queryClient.invalidateQueries({ queryKey: ['projects'] })
        toast.success('Preview ja estava concluido.')
        return
      }
      setPreviewProgress((p) => Math.max(p, 96))
      void queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Finalizacao do preview reenfileirada.')
    } catch (e) {
      const detail = isAxiosError(e) ? e.response?.data : undefined
      const msg =
        typeof detail === 'object' && detail !== null && 'detail' in detail && typeof (detail as { detail: unknown }).detail === 'string'
          ? (detail as { detail: string }).detail
          : 'Nao foi possivel retomar o preview.'
      toast.error(msg)
    }
  }, [projectId, queryClient])

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
    previewStatus,
    previewProgress,
    sparseCloudAvailable,
    sparseCloudTrackProgress,
    sparseCloudTrackHint,
    startProcessing,
    cancelProcessing,
    finalizeStuckMain,
    finalizeStuckPreview,
  }
}
