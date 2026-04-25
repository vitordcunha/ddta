import { useCallback, useEffect, useRef, useState } from 'react'
import {
  projectsService,
  type CalibrationRecommendation,
  type CalibrationSessionDetail,
} from '@/services/projectsService'

function streamUrl(sessionId: string): string {
  const apiBase = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1').replace(/\/$/, '')
  const workspaceId = import.meta.env.VITE_WORKSPACE_ID ?? 'default'
  const sep = apiBase.includes('?') ? '&' : '?'
  return `${apiBase}/calibration-sessions/${sessionId}/stream${sep}workspace_id=${encodeURIComponent(workspaceId)}`
}

const ANALYSIS_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutos

export type UseCalibrationSessionResult = {
  session: CalibrationSessionDetail | null
  loading: boolean
  error: string | null
  /** True quando a sessao ficou em "analyzing" por mais de 5 minutos sem concluir. */
  analysisTimedOut: boolean
  refetch: () => Promise<void>
}

/**
 * Carrega a sessão e acompanha `analyzing` → `ready` via SSE, com polling de segurança.
 */
export function useCalibrationSession(
  sessionId: string | null,
  enabled: boolean,
  /** Incrementar após upload para religar SSE/polling com status `analyzing`. */
  revision = 0,
): UseCalibrationSessionResult {
  const [session, setSession] = useState<CalibrationSessionDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analysisTimedOut, setAnalysisTimedOut] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const esRef = useRef<EventSource | null>(null)
  const analysisStartRef = useRef<number | null>(null)

  const clearTimers = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }
  }

  const refetch = useCallback(async () => {
    if (!sessionId) return
    setLoading(true)
    setError(null)
    try {
      const data = await projectsService.getCalibrationSession(sessionId)
      setSession(data)
    } catch {
      setError('Não foi possível carregar a sessão de calibração.')
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    if (!enabled || !sessionId) {
      clearTimers()
      setSession(null)
      return
    }

    let cancelled = false

    const load = async () => {
      try {
        const data = await projectsService.getCalibrationSession(sessionId)
        if (!cancelled) {
          setSession(data)
          setError(null)
        }
        return data
      } catch {
        if (!cancelled) setError('Não foi possível carregar a sessão de calibração.')
        return null
      }
    }

    const startPoll = () => {
      if (pollRef.current) return
      pollRef.current = setInterval(() => void load(), 2500)
    }

    void (async () => {
      const first = await load()
      if (cancelled || !first) return
      if (first.status !== 'analyzing') return

      // Iniciar contagem de tempo para timeout de analise
      analysisStartRef.current = Date.now()
      setAnalysisTimedOut(false)
      const timeoutHandle = window.setTimeout(() => {
        if (!cancelled) setAnalysisTimedOut(true)
      }, ANALYSIS_TIMEOUT_MS)

      const es = new EventSource(streamUrl(sessionId))
      esRef.current = es
      es.addEventListener('slot_scored', (ev) => {
        try {
          const patch = JSON.parse((ev as MessageEvent).data as string) as {
            slotId?: string
            score?: number | null
            status?: string
          }
          const sid = patch.slotId
          if (!sid) return
          setSession((prev) => {
            if (!prev?.theoretical_grid?.slots) return prev
            const slots = prev.theoretical_grid.slots.map((s) =>
              s.id === sid
                ? {
                    ...s,
                    status: (patch.status as typeof s.status) ?? s.status,
                    best_score: patch.score ?? (s as { best_score?: number }).best_score,
                  }
                : s,
            )
            return {
              ...prev,
              theoretical_grid: { ...prev.theoretical_grid, slots },
            }
          })
        } catch {
          /* ignore */
        }
      })
      es.addEventListener('calibration', (ev) => {
        try {
          const payload = JSON.parse((ev as MessageEvent).data as string) as {
            status: string
            exif_report: CalibrationSessionDetail['exif_report']
            pixel_report: CalibrationSessionDetail['pixel_report']
            theoretical_grid?: CalibrationSessionDetail['theoretical_grid']
            recommendations?: CalibrationRecommendation[]
          }
          setSession((prev) => {
            if (!prev || prev.id !== sessionId) {
              return {
                id: sessionId,
                project_id: '',
                status: payload.status,
                created_at: '',
                updated_at: '',
                exif_report: payload.exif_report,
                pixel_report: payload.pixel_report ?? null,
                theoretical_grid: payload.theoretical_grid ?? null,
                recommendations: payload.recommendations ?? [],
              }
            }
            return {
              ...prev,
              status: payload.status,
              exif_report: payload.exif_report ?? prev.exif_report,
              pixel_report: payload.pixel_report ?? prev.pixel_report,
              theoretical_grid: payload.theoretical_grid ?? prev.theoretical_grid,
              recommendations: payload.recommendations ?? prev.recommendations,
            }
          })
          if (payload.status === 'ready' || payload.status === 'failed') {
            clearTimers()
            clearTimeout(timeoutHandle)
            setAnalysisTimedOut(false)
            void load()
          }
        } catch {
          /* ignore */
        }
      })
      es.onerror = () => {
        es.close()
        if (esRef.current === es) esRef.current = null
        startPoll()
      }

      return () => {
        clearTimeout(timeoutHandle)
      }
    })()

    return () => {
      cancelled = true
      clearTimers()
      analysisStartRef.current = null
    }
  }, [sessionId, enabled, revision])

  return { session, loading, error, analysisTimedOut, refetch }
}

export type { CalibrationSessionDetail } from '@/services/projectsService'
