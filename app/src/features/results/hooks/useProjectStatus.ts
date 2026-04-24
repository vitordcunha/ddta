import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ProcessingLogEntry, ProcessingStep } from '@/features/results/types'

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

export function useProjectStatus(initialStatus: RuntimeStatus) {
  const [status, setStatus] = useState<RuntimeStatus>(initialStatus)
  const [progress, setProgress] = useState(initialStatus === 'completed' ? 100 : 0)
  const [message, setMessage] = useState(initialStatus === 'completed' ? 'Concluido' : 'Aguardando')
  const [logs, setLogs] = useState<ProcessingLogEntry[]>([])
  const timerRef = useRef<number | null>(null)

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => stopTimer, [stopTimer])

  const startProcessing = useCallback(() => {
    stopTimer()
    setStatus('processing')
    setProgress(0)
    setMessage(steps[0].message)
    setLogs([{ timestamp: new Date().toLocaleTimeString('pt-BR'), message: steps[0].message }])

    let value = 0
    timerRef.current = window.setInterval(() => {
      value = Math.min(value + Math.ceil(Math.random() * 4), 100)
      setProgress(value)

      const currentStep = [...steps].reverse().find((step) => value >= step.progress) ?? steps[0]
      setMessage(currentStep.message)
      setLogs((prev) => {
        const alreadyLogged = prev.some((entry) => entry.message === currentStep.message)
        if (alreadyLogged) return prev
        return [...prev, { timestamp: new Date().toLocaleTimeString('pt-BR'), message: currentStep.message }]
      })

      if (value >= 100) {
        stopTimer()
        setStatus('completed')
      }
    }, 1300)
  }, [stopTimer])

  const cancelProcessing = useCallback(() => {
    stopTimer()
    setStatus('failed')
    setMessage('Processamento cancelado')
  }, [stopTimer])

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
