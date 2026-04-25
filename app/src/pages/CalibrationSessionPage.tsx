import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Feature, Polygon } from 'geojson'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge, Button } from '@/components/ui'
import { CalibrationGridMap } from '@/features/flight-planner/components/CalibrationGridMap'
import { CalibrationSlotInspector } from '@/features/flight-planner/components/CalibrationSlotInspector'
import { useCalibrationSession } from '@/features/flight-planner/hooks/useCalibrationSession'
import { useCalibrationStore } from '@/features/flight-planner/stores/useCalibrationStore'
import { useFlightStore } from '@/features/flight-planner/stores/useFlightStore'
import { mergeCalibrationParamChanges } from '@/features/flight-planner/utils/mergeCalibrationParamChanges'
import { toWorkspace, WORKSPACE_ROOT } from '@/constants/routes'
import { projectsService, type CalibrationImageSummary } from '@/services/projectsService'

function polygonFromSnapshot(raw: Record<string, unknown> | null | undefined): Feature<Polygon> | null {
  if (!raw || typeof raw !== 'object') return null
  const g = raw as { type?: string; geometry?: Polygon; coordinates?: unknown }
  if (g.type === 'Feature' && g.geometry?.type === 'Polygon') {
    return raw as unknown as Feature<Polygon>
  }
  if (g.type === 'Polygon' && Array.isArray(g.coordinates)) {
    return { type: 'Feature', properties: {}, geometry: raw as unknown as Polygon }
  }
  return null
}

/**
 * Vista standalone da sessão de calibração (mapa + painel por slot).
 */
export function CalibrationSessionPage() {
  const { sessionId = '' } = useParams<{ sessionId: string }>()
  const { session, loading, error } = useCalibrationSession(sessionId, !!sessionId, 0)
  const [images, setImages] = useState<CalibrationImageSummary[]>([])
  const [showFootprints, setShowFootprints] = useState(false)

  const plannerCalibrationSessionId = useFlightStore((s) => s.calibrationSessionId)
  const setFlightParams = useFlightStore((s) => s.setParams)

  const {
    selectedSlotId,
    setSelectedSlotId,
    reset: resetCalibrationStore,
    highlightedSlotIds,
    highlightedRecommendationId,
    activateRecommendation,
    clearHighlight,
  } = useCalibrationStore()

  useEffect(() => {
    resetCalibrationStore()
    return () => resetCalibrationStore()
  }, [sessionId, resetCalibrationStore])

  useEffect(() => {
    if (!sessionId) {
      setImages([])
      return
    }
    void projectsService
      .listCalibrationSessionImages(sessionId)
      .then(setImages)
      .catch(() => setImages([]))
  }, [sessionId, session?.updated_at, session?.status])

  const calibrationPoly = useMemo(
    () => polygonFromSnapshot(session?.polygon_snapshot ?? undefined),
    [session?.polygon_snapshot],
  )
  const gridSlots = session?.theoretical_grid?.slots ?? []
  const slotReportsById = useMemo(() => {
    const list = session?.pixel_report?.slot_reports ?? []
    const m: Record<string, (typeof list)[0]> = {}
    for (const r of list) {
      if (r.slot_id) m[r.slot_id] = r
    }
    return m
  }, [session?.pixel_report?.slot_reports])

  const photoFootprints = useMemo(() => {
    return images
      .map((im) => {
        const poly = im.extras?.footprint_polygon as Polygon | undefined
        if (!poly || poly.type !== 'Polygon' || !poly.coordinates?.[0]?.length) return null
        const ring = poly.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number])
        return { imageId: im.id, ring }
      })
      .filter(Boolean) as { imageId: string; ring: [number, number][] }[]
  }, [images])

  const selectedSlot = useMemo(
    () => gridSlots.find((s) => s.id === selectedSlotId) ?? null,
    [gridSlots, selectedSlotId],
  )

  const recommendations = session?.recommendations ?? []
  const mergedPlannerPatch = useMemo(
    () => mergeCalibrationParamChanges(recommendations),
    [recommendations],
  )
  const canApplyPlannerSuggestions = Object.keys(mergedPlannerPatch).length > 0
  const plannerMatchesThisSession =
    !!sessionId && plannerCalibrationSessionId === sessionId

  const applyPlannerSuggestions = () => {
    if (!canApplyPlannerSuggestions || session?.status !== 'ready') return
    if (!plannerMatchesThisSession) return
    setFlightParams(mergedPlannerPatch)
    toast.success('Parâmetros do plano atualizados com as sugestões do voo-teste.')
  }

  const workspacePlanHref =
    session?.project_id != null
      ? toWorkspace(WORKSPACE_ROOT, { panel: 'plan', project: session.project_id })
      : WORKSPACE_ROOT

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-white/10 px-4 py-3">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <Link
            to={WORKSPACE_ROOT}
            className="inline-flex items-center gap-2 text-sm text-primary-300 hover:text-primary-200"
          >
            <ArrowLeft className="size-4" />
            Voltar ao espaço de trabalho
          </Link>
          {sessionId ? (
            <span className="font-mono text-[11px] text-neutral-500">
              Sessão <span className="text-neutral-400">{sessionId}</span>
            </span>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-6">
        {loading && !session ? (
          <p className="flex items-center gap-2 text-sm text-neutral-400">
            <Loader2 className="size-4 animate-spin" /> A carregar sessão…
          </p>
        ) : null}
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        {session ? (
          <>
            <p className="text-sm text-neutral-400">
              Estado: <span className="text-neutral-200">{session.status}</span>
              {session.project_id ? (
                <>
                  {' '}
                  · Projeto{' '}
                  <span className="font-mono text-neutral-300">{session.project_id}</span>
                </>
              ) : null}
            </p>

            {calibrationPoly && gridSlots.length > 0 ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h1 className="text-base font-medium text-neutral-100">Grade de calibração</h1>
                  {photoFootprints.length > 0 ? (
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-neutral-400">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border border-neutral-600"
                        checked={showFootprints}
                        onChange={(e) => setShowFootprints(e.target.checked)}
                      />
                      Footprints por foto (aprox.)
                    </label>
                  ) : null}
                </div>
                <div className="flex flex-col gap-4 lg:flex-row">
                  <div className="min-h-[min(55vh,420px)] min-w-0 flex-1">
                    <CalibrationGridMap
                      baseLayerId="satellite"
                      calibrationPolygon={calibrationPoly}
                      slots={gridSlots}
                      heightClass="h-[min(55vh,420px)]"
                      onSlotClick={(id) => {
                        clearHighlight()
                        setSelectedSlotId(selectedSlotId === id ? null : id)
                      }}
                      highlightSlotId={selectedSlotId}
                      highlightedSlotIds={highlightedSlotIds}
                      slotReportsById={slotReportsById}
                      photoFootprints={photoFootprints}
                      showPhotoFootprints={showFootprints}
                    />
                  </div>
                  {sessionId && selectedSlot ? (
                    <div className="w-full shrink-0 lg:w-64">
                      <CalibrationSlotInspector
                        sessionId={sessionId}
                        slot={selectedSlot}
                        slotReport={slotReportsById[selectedSlot.id]}
                        images={images}
                        onClose={() => setSelectedSlotId(null)}
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-neutral-500 lg:w-48 lg:pt-4">
                      Clique num slot do mapa para ver miniatura e EXIF.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-neutral-500">
                Sem polígono ou grade nesta sessão (snapshot indisponível ou sessão vazia).
              </p>
            )}

            {recommendations.length > 0 ? (
              <section className="space-y-3 rounded-lg border border-white/10 bg-black/30 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 className="text-sm font-medium text-neutral-100">Sugestões do relatório</h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={
                        !canApplyPlannerSuggestions ||
                        session.status !== 'ready' ||
                        !plannerMatchesThisSession
                      }
                      onClick={applyPlannerSuggestions}
                    >
                      Aplicar ao planeador
                    </Button>
                  </div>
                </div>
                {!plannerMatchesThisSession && session.project_id ? (
                  <p className="text-xs text-amber-200/90">
                    Para aplicar automaticamente os parâmetros ao plano atual, abra o projeto no planejador e use
                    «Usar no planejador» nesta sessão, ou{' '}
                    <Link to={workspacePlanHref} className="text-primary-300 underline hover:text-primary-200">
                      vá ao plano do projeto
                    </Link>
                    .
                  </p>
                ) : null}
                <ul className="space-y-3">
                  {recommendations.map((r) => (
                    <li
                      key={r.id}
                      className={`rounded-lg border p-3 text-[11px] leading-relaxed transition-colors ${
                        highlightedRecommendationId === r.id
                          ? 'border-orange-500/40 bg-orange-500/10'
                          : 'border-white/10 bg-black/20'
                      }`}
                    >
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        {r.affected_slots && r.affected_slots.length > 0 ? (
                          <button
                            type="button"
                            title={
                              highlightedRecommendationId === r.id
                                ? 'Limpar destaque'
                                : `Destacar ${r.affected_slots.length} slot(s) no mapa`
                            }
                            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                              highlightedRecommendationId === r.id
                                ? 'bg-orange-500/30 text-orange-200 hover:bg-orange-500/20'
                                : 'bg-white/10 text-neutral-400 hover:bg-white/15 hover:text-neutral-200'
                            }`}
                            onClick={() =>
                              highlightedRecommendationId === r.id
                                ? clearHighlight()
                                : activateRecommendation(r.id, r.affected_slots)
                            }
                          >
                            {r.affected_slots.length} slot{r.affected_slots.length !== 1 ? 's' : ''}
                          </button>
                        ) : null}
                        <Badge
                          variant={
                            r.severity === 'bad'
                              ? 'error'
                              : r.severity === 'warn'
                                ? 'warning'
                                : 'info'
                          }
                        >
                          {r.severity}
                        </Badge>
                        <span className="text-[10px] uppercase tracking-wide text-neutral-500">{r.kind}</span>
                      </div>
                      <p className="text-neutral-400">{r.rationale}</p>
                      <p className="mt-2 font-medium text-neutral-200">{r.text}</p>
                      {r.param_changes.length > 0 ? (
                        <ul className="mt-2 list-inside list-disc text-neutral-500">
                          {r.param_changes.map((pc) => (
                            <li key={`${r.id}-${pc.field}`}>
                              <span className="font-mono text-neutral-300">{pc.field}</span>
                              {pc.current != null ? (
                                <>
                                  {' '}
                                  {pc.current} → <span className="text-primary-300/95">{pc.suggested}</span>
                                </>
                              ) : (
                                <> → {pc.suggested}</>
                              )}
                              {pc.hint ? <span className="block pl-4 text-neutral-600">{pc.hint}</span> : null}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {!canApplyPlannerSuggestions && session.status === 'ready' ? (
                  <p className="text-xs text-neutral-500">
                    Sugestões só com texto (ex.: câmera) não alteram parâmetros do planeador automaticamente.
                  </p>
                ) : null}
              </section>
            ) : session.status === 'ready' && !loading ? (
              <p className="text-xs text-neutral-500">Sem recomendações devolvidas pelo servidor.</p>
            ) : null}
          </>
        ) : null}
      </main>
    </div>
  )
}
