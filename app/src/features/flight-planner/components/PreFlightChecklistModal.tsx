import * as Dialog from '@radix-ui/react-dialog'
import { useCallback, useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react'
import type { Feature, Polygon } from 'geojson'
import { ImageUp, Sparkles, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge, Button } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useCalibrationSession } from '@/features/flight-planner/hooks/useCalibrationSession'
import { computeMinShutterSuggestion, getCameraModelGuidance } from '@/features/flight-planner/utils/cameraGuidance'
import type { CalibrationMission } from '@/features/flight-planner/utils/calibrationPlan'
import { buildChecklist, type ChecklistItemDef, type ChecklistGroup } from '@/features/flight-planner/utils/preFlightChecklist'
import {
  readChecklistChecked,
  writeChecklistChecked,
  writePreFlightKmzModalSkip,
} from '@/features/flight-planner/utils/preFlightChecklistStorage'
import { buildSolarFlightContextLines } from '@/features/flight-planner/utils/solarPosition'
import type {
  FlightParams,
  WeatherData,
  FlightAssessment,
  FlightStats,
} from '@/features/flight-planner/types'
import { detectActiveQualityPreset, estimateGsdCmFromParams } from '@/features/flight-planner/utils/flightParamGuidance'
import { wmoCodeToConditionPt, windDegToCompass } from '@/features/flight-planner/utils/weatherHelpers'

const format = (n: number, d: number) => n.toFixed(d).replace('.', ',')

export type PreFlightChecklistFlow = 'mission' | 'calibration'

export type PreFlightChecklistModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** `mission`: checklist completo até KMZ da área total. `calibration`: sem etapa câmera; exportação só do voo de teste. */
  flow?: PreFlightChecklistFlow
  projectId: string
  params: FlightParams
  weather: WeatherData | null
  assessment: FlightAssessment | null
  /** Centro do polígono; necessário para o texto de posição solar. */
  polygonCenter: { lat: number; lon: number } | null
  /** Polígono da missão completa (preview da área de calibração). */
  missionPolygon: Feature<Polygon> | null
  calibrationMission: CalibrationMission | null
  calibrationSessionId: string | null
  /** Estatísticas da missão principal (área completa). */
  missionStats: FlightStats | null
  onConfirmDownload: () => void
  /** Cria sessão no backend e baixa o KMZ `-calibration.kmz`. */
  onCalibrationDownload: () => void | Promise<void>
  /** Abre o diálogo de envio de JPEGs da sessão ativa (mesmo fluxo do painel). */
  onRequestCalibrationUpload: () => void
  isGeneratingKmz: boolean
  isCalibrationKmzGenerating: boolean
  /** Incrementar após upload de fotos de calibração para atualizar estado da sessão. */
  calibrationSessionRevision?: number
}

function flatIds(groups: ChecklistGroup[]) {
  return groups.flatMap((g) => g.items.map((i) => i.id))
}

function mergeChecked(state: Record<string, boolean>, ids: string[], prev: Record<string, boolean>) {
  const next: Record<string, boolean> = { ...state }
  for (const id of ids) {
    if (next[id] == null) next[id] = prev[id] ?? false
  }
  for (const k of Object.keys(next)) {
    if (!ids.includes(k)) delete next[k]
  }
  return next
}

export function PreFlightChecklistModal({
  open,
  onOpenChange,
  flow = 'mission',
  projectId,
  params,
  weather,
  assessment,
  polygonCenter,
  missionPolygon,
  calibrationMission,
  calibrationSessionId,
  missionStats,
  onConfirmDownload,
  onCalibrationDownload,
  onRequestCalibrationUpload,
  isGeneratingKmz,
  isCalibrationKmzGenerating,
  calibrationSessionRevision = 0,
}: PreFlightChecklistModalProps) {
  const stepMeta = useMemo(() => {
    if (flow === 'calibration') {
      return {
        labels: ['Checklist', 'Condições', 'Voo de calibração e exportação'] as const,
        lastStep: 2,
        exportStepIndex: 2,
        cameraStepIndex: null as number | null,
      }
    }
    return {
      labels: ['Checklist', 'Condições', 'Câmera', 'Missão e exportação'] as const,
      lastStep: 3,
      exportStepIndex: 3,
      cameraStepIndex: 2,
    }
  }, [flow])

  const now = useMemo(() => {
    void open
    void projectId
    return new Date()
  }, [open, projectId])
  const [checklist, setChecklist] = useState<Record<string, boolean>>({})
  const [step, setStep] = useState(0)
  const [noShow, setNoShow] = useState(false)
  const titleId = useId()
  const descId = useId()

  const groups = useMemo(
    () => buildChecklist(params, weather, assessment, now),
    [params, weather, assessment, now],
  )
  const preset = useMemo(() => detectActiveQualityPreset(params), [params])
  const cameraG = useMemo(
    () => getCameraModelGuidance(params.droneModel, preset),
    [params.droneModel, preset],
  )
  const gsdCm = estimateGsdCmFromParams(params)
  const shutterHint = useMemo(
    () => computeMinShutterSuggestion({ speedMs: params.speedMs, gsdCm }),
    [params.speedMs, gsdCm],
  )
  const solarLines = useMemo(
    () =>
      polygonCenter
        ? buildSolarFlightContextLines({
            lat: polygonCenter.lat,
            lon: polygonCenter.lon,
            now,
            weather,
            droneModel: params.droneModel,
          })
        : null,
    [polygonCenter, now, weather, params.droneModel],
  )

  const { session: calibrationSession, loading: calibrationLoading } = useCalibrationSession(
    calibrationSessionId,
    open && !!calibrationSessionId,
    calibrationSessionRevision,
  )
  const recommendationCount = calibrationSession?.recommendations?.length ?? 0
  const slotCounts = calibrationSession?.exif_report?.calibration_grid?.slot_counts

  // ids de checklist dinâmicos (ex.: clima) precisam fundir o que veio do localStorage
  useEffect(() => {
    if (!open) return
    const fromStore = readChecklistChecked(projectId)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- merge de itens com assessment/clima
    setChecklist((prev) => mergeChecked(fromStore, flatIds(groups), prev))
  }, [open, projectId, groups])

  const toggle = (id: string, v: boolean) => {
    setChecklist((prev) => {
      const next = { ...prev, [id]: v }
      writeChecklistChecked(projectId, next)
      return next
    })
  }

  const runConfirm = useCallback(() => {
    if (noShow && flow === 'mission') writePreFlightKmzModalSkip(projectId, true)
    if (flow === 'mission') {
      onConfirmDownload()
    }
    onOpenChange(false)
  }, [noShow, flow, onConfirmDownload, onOpenChange, projectId])

  const onContentKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' || e.repeat) return
    const t = e.target as HTMLElement
    if (t.tagName === 'TEXTAREA') return
    if (t.tagName === 'INPUT' && (t as HTMLInputElement).type === 'checkbox') return
    if (t.closest('label')?.querySelector('input[type="checkbox"]')) return
    if (t.tagName === 'BUTTON') return
    e.preventDefault()
    if (step < stepMeta.lastStep) {
      setStep((s) => Math.min(s + 1, stepMeta.lastStep))
    } else {
      runConfirm()
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm"
          onClick={() => onOpenChange(false)}
        />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[201] flex max-h-[min(92vh,780px)] w-[min(92vw,36rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-neutral-800 bg-neutral-900 shadow-xl outline-none animate-fade-up"
          aria-labelledby={titleId}
          aria-describedby={descId}
          onKeyDown={onContentKeyDown}
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 p-4 pb-3">
            <div className="min-w-0 pr-2">
              <Dialog.Title id={titleId} className="text-lg font-semibold tracking-tight text-neutral-100">
                {flow === 'calibration' ? 'Antes do voo de calibração' : 'Antes de voar'}
              </Dialog.Title>
              <p id={descId} className="mt-1.5 text-sm leading-relaxed text-neutral-400">
                {flow === 'calibration' ? (
                  <>
                    Checklist e condições para o voo de teste; na última etapa exporta o KMZ de calibração (área
                    reduzida) e acompanha a sessão. A grade no mapa fica no painel «Voo de calibração»; a análise
                    detalhada abre na página da sessão.
                  </>
                ) : (
                  <>
                    Checklist e condições primeiro; depois câmera; por fim missão e calibração (KMZ de teste) e
                    confirmação do KMZ da área completa. O KMZ completo só é gerado ao confirmar na última etapa. A
                    pré-visualização da grade no mapa fica no painel «Voo de calibração»; a análise detalhada abre na
                    página da sessão.
                  </>
                )}
              </p>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="shrink-0 rounded-md border border-transparent p-1.5 text-neutral-400 hover:border-neutral-800 hover:bg-neutral-950 hover:text-neutral-100"
                aria-label="Fechar (Esc)"
              >
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
            }}
            className="flex min-h-0 flex-1 flex-col p-4 pt-3"
          >
            <div className="shrink-0" aria-label="Etapas do resumo">
              <p className="text-center text-xs text-neutral-500">
                Etapa {step + 1} de {stepMeta.labels.length} — {stepMeta.labels[step]}
              </p>
              <div className="mt-2 flex w-full flex-wrap items-center justify-center gap-1.5">
                {stepMeta.labels.map((label, i) => {
                  const active = i === step
                  const done = i < step
                  return (
                    <span
                      key={label}
                      className={cn(
                        'rounded-md border px-2 py-1 text-[10px] font-medium leading-none sm:text-[11px]',
                        active
                          ? 'border-primary-500/50 bg-primary-700/25 text-primary-100'
                          : done
                            ? 'border-white/10 bg-white/5 text-neutral-500'
                            : 'border-white/5 bg-black/20 text-neutral-600',
                      )}
                    >
                      {i + 1}. {label}
                    </span>
                  )
                })}
              </div>
            </div>

            <div className="relative z-0 mt-3 max-h-[min(46vh,440px)] min-h-[12rem] flex-1 overflow-y-auto overflow-x-hidden overscroll-contain pr-1">
              {step === 0 && (
                <>
                {groups.map((g) => (
                  <section key={g.id} className="mb-4 last:mb-0">
                    <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                      {g.title}
                    </h3>
                    <ul className="space-y-2">
                      {g.items.map((it) => (
                        <li key={it.id}>
                          <CheckRow item={it} checked={!!checklist[it.id]} onChange={(v) => toggle(it.id, v)} />
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
                </>
              )}

              {step === 1 && (
                <>
                {assessment ? (
                  <div className="space-y-2">
                    <Badge variant={assessment.go ? 'success' : 'error'}>
                      {assessment.go
                        ? 'Avaliação: sem bloqueios lógicos (vento, trovoada, chuva forte, etc.)'
                        : 'Avaliação: condições com risco lógico elevado (veja a lista)'}
                    </Badge>
                    {assessment.issues.length > 0 && (
                      <ul className="list-inside list-disc text-xs text-red-300/95">
                        {assessment.issues.map((t) => (
                          <li key={t}>{t}</li>
                        ))}
                      </ul>
                    )}
                    {assessment.warnings.length > 0 && (
                      <ul className="list-inside list-disc text-xs text-amber-200/90">
                        {assessment.warnings.map((t) => (
                          <li key={t}>{t}</li>
                        ))}
                      </ul>
                    )}
                    {assessment.tips.length > 0 && (
                      <ul className="list-inside list-disc text-xs text-neutral-400">
                        {assessment.tips.map((t) => (
                          <li key={t}>{t}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500">Avaliação ainda indisponível; aguarde o clima carregar.</p>
                )}

                {weather ? (
                  <div className="mt-4 space-y-2 text-xs text-neutral-300">
                    <p>
                      {weather.conditionLabel?.trim() ?? wmoCodeToConditionPt(weather.weatherCode ?? 0)};{' '}
                      {format(weather.temperatureC, 1)} °C; nublado {Math.round(weather.cloudCoveragePct)}% ; vento{' '}
                      {format(weather.windSpeedMs, 1)} m/s ({windDegToCompass(weather.windDirectionDeg)}), rajadas
                      {weather.windGustsMs != null
                        ? ` ${format(weather.windGustsMs, 1)} m/s.`
                        : ' —.'}
                    </p>
                    <p>
                      {weather.isDay === false
                        ? 'Dados indicam noite: verifique regras de voo (VLOS, luz, etc.) se planejar voo nesse horário.'
                        : 'Dados de dia indicados para o instante: compare com a posição solar abaixo.'}
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-amber-200/90">Sem leitura de clima para a área — confira o tempo no local.</p>
                )}

                <div className="mt-3 space-y-2 rounded-lg border border-white/10 bg-black/25 p-2.5 text-xs leading-relaxed text-neutral-300">
                  {solarLines ? (
                    solarLines.map((line, idx) => (
                      <p key={idx} className="last:mb-0">
                        {line}
                      </p>
                    ))
                  ) : (
                    <p>
                      Desenhe o polígono no mapa para estimar a posição solar a partir do centro da área, a janela
                      ideal e filtros ND (heurística sol + previsão).
                    </p>
                  )}
                </div>
                </>
              )}

              {step === stepMeta.exportStepIndex && (
                <div className="space-y-4">
                  <p className="text-[11px] leading-relaxed text-neutral-500">
                    {flow === 'calibration' ? (
                      <>
                        Voo de teste no recorte central da área desenhada (mesmos parâmetros de overlap). Use
                        «Executar voo de calibração» no painel para ver a grade no mapa; aqui exporta o KMZ deste voo
                        curto e acompanha a sessão. Uploads e relatório detalhado seguem na página da sessão.
                      </>
                    ) : (
                      <>
                        Recomendado: voo de teste na área pequena antes do KMZ da missão completa. Use «Executar voo de
                        calibração» no painel para ver a grade no mapa; aqui confirma e exporta o KMZ de teste. Uploads
                        e relatório detalhado seguem na página da sessão.
                      </>
                    )}
                  </p>

                  {flow === 'mission' ? (
                    <div className="space-y-2 rounded-lg border border-white/10 bg-black/25 p-3">
                      <p className="text-xs font-medium text-neutral-200">Missão principal (área desenhada)</p>
                      {missionStats ? (
                        <ul className="space-y-1 text-[11px] text-neutral-400">
                          <li>
                            <span className="text-neutral-500">GSD:</span>{' '}
                            <span className="font-mono text-neutral-200">{format(missionStats.gsdCm, 2)}</span> cm/px
                          </li>
                          <li>
                            <span className="text-neutral-500">Fotos estimadas:</span>{' '}
                            <span className="font-mono text-neutral-200">{missionStats.estimatedPhotos}</span>
                          </li>
                          <li>
                            <span className="text-neutral-500">Tempo estimado:</span>{' '}
                            <span className="font-mono text-neutral-200">{format(missionStats.estimatedTimeMin, 1)}</span>{' '}
                            min ·{' '}
                            <span className="text-neutral-500">Waypoints:</span>{' '}
                            <span className="font-mono text-neutral-200">{missionStats.waypointCount}</span> ·{' '}
                            <span className="text-neutral-500">Área:</span>{' '}
                            <span className="font-mono text-neutral-200">{format(missionStats.areaHa, 2)}</span> ha
                          </li>
                        </ul>
                      ) : (
                        <p className="text-[11px] text-amber-200/85">Sem estatísticas da missão (aguarde o cálculo da rota).</p>
                      )}
                    </div>
                  ) : null}

                  <div className="w-full space-y-3 rounded-lg border border-white/10 bg-black/25 p-3">
                    <p className="text-xs font-medium text-neutral-200">
                      {flow === 'calibration' ? 'Voo de calibração (KMZ de teste)' : 'Voo de calibração (área reduzida)'}
                    </p>
                    {calibrationMission && missionPolygon ? (
                      <p className="text-[11px] leading-relaxed text-neutral-400">
                        Mesmos parâmetros de altitude e velocidade; cerca de{' '}
                        <span className="font-mono text-neutral-200">{calibrationMission.stats.estimatedPhotos}</span>{' '}
                        fotos estimadas,{' '}
                        <span className="font-mono text-neutral-200">
                          {format(calibrationMission.stats.estimatedTimeMin, 1)}
                        </span>{' '}
                        min,{' '}
                        <span className="font-mono text-neutral-200">{calibrationMission.stats.waypointCount}</span>{' '}
                        waypoints. Se utilizou «Executar voo de calibração» no painel, a grade e a rota já estiveram
                        no mapa; caso contrário, pode mesmo assim criar a sessão e baixar o KMZ aqui.
                      </p>
                    ) : (
                      <p className="text-[11px] text-amber-200/85">
                        Não foi possível montar um recorte central automático. Ajuste a área ou os parâmetros.
                      </p>
                    )}
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="inline-flex w-full items-center justify-center gap-1.5 border-neutral-700 sm:w-auto"
                      disabled={!calibrationMission || isCalibrationKmzGenerating}
                      onClick={() => void Promise.resolve(onCalibrationDownload())}
                    >
                      <Sparkles className="size-3.5 shrink-0 text-primary-300" aria-hidden />
                      {isCalibrationKmzGenerating ? 'Gerando…' : 'Baixar KMZ de calibração'}
                    </Button>
                  </div>

                  {calibrationSessionId ? (
                    <div className="space-y-3 rounded-lg border border-primary-500/20 bg-primary-500/[0.06] p-3 text-xs text-neutral-300">
                      <div>
                        <p className="text-[11px] font-medium text-neutral-200">Sessão ativa</p>
                        <p className="mt-1 font-mono text-[10px] text-neutral-400 break-all">{calibrationSessionId}</p>
                        <p className="mt-2 text-[11px] text-neutral-500">
                          {calibrationSession?.status === 'ready'
                            ? 'Relatório pronto.'
                            : calibrationSession?.status === 'analyzing'
                              ? 'Análise em curso…'
                              : calibrationSession?.status === 'failed'
                                ? 'Análise falhou.'
                                : calibrationLoading
                                  ? 'A carregar…'
                                  : 'Aguardando envio de fotos ou processamento.'}
                        </p>
                      </div>
                      {slotCounts && typeof slotCounts.total === 'number' ? (
                        <p className="text-[11px] text-neutral-500">
                          Grade: {slotCounts.covered ?? 0} cobertos, {slotCounts.gap ?? 0} lacunas,{' '}
                          {slotCounts.warning ?? 0} avisos, {slotCounts.empty ?? 0} vazios (total {slotCounts.total}).
                        </p>
                      ) : null}
                      {calibrationSession?.status === 'ready' && recommendationCount > 0 ? (
                        <p className="text-[11px] text-primary-200/90">
                          {recommendationCount} sugestão(ões) no relatório — abra a página da sessão para ver, destacar
                          no mapa e aplicar ao planeador.
                        </p>
                      ) : null}
                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="inline-flex items-center justify-center gap-1.5"
                          onClick={() => onRequestCalibrationUpload()}
                        >
                          <ImageUp className="size-3.5 shrink-0" aria-hidden />
                          Enviar fotos (EXIF)
                        </Button>
                        <Link
                          to={`/calibration/${calibrationSessionId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-9 items-center justify-center rounded-md border border-neutral-800 bg-transparent px-3 text-sm font-medium text-neutral-100 hover:border-neutral-700 hover:bg-neutral-900"
                        >
                          Abrir análise completa
                        </Link>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              {flow === 'mission' && step === stepMeta.cameraStepIndex && (
                <div className="space-y-3 text-xs text-neutral-300">
                  <p>
                    <span className="font-medium text-neutral-200">{cameraG.title}.</span>
                  </p>
                  {cameraG.paragraphs.map((p) => (
                    <p key={p} className="leading-relaxed text-neutral-400">
                      {p}
                    </p>
                  ))}
                  <p className="rounded border border-primary-500/20 bg-primary-500/5 p-2.5 text-neutral-200/95">
                    {shutterHint}
                  </p>
                </div>
              )}
            </div>

            <div className="relative z-20 mt-auto flex shrink-0 flex-col gap-3 border-t border-white/10 bg-neutral-900 pt-4">
              {step === stepMeta.lastStep && flow === 'mission' ? (
                <label className="inline-flex max-w-full cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-neutral-500 sm:max-w-xl">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-3.5 w-3.5 rounded border border-neutral-600"
                    checked={noShow}
                    onChange={(e) => setNoShow(e.target.checked)}
                  />
                  <span>
                    Não mostrar para este projeto (futuros cliques em “Baixar KMZ” seguem direto; ainda acessível pelo
                    atalho no painel).
                  </span>
                </label>
              ) : null}
              <div
                className="flex w-full flex-wrap items-center justify-between gap-3"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="-ml-2 text-neutral-500 hover:text-neutral-300"
                  onClick={() => onOpenChange(false)}
                >
                  Cancelar
                </Button>
                <div className="flex flex-wrap items-center gap-2">
                  {step > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="md"
                      className="text-neutral-400"
                      onClick={() => setStep((s) => Math.max(0, s - 1))}
                    >
                      Anterior
                    </Button>
                  ) : null}
                  {step < stepMeta.lastStep ? (
                    <Button
                      type="button"
                      size="md"
                      className="min-w-[min(100%,9rem)] border border-neutral-200 bg-neutral-100 text-neutral-900 hover:border-white hover:bg-white hover:text-neutral-950 sm:min-w-[9rem]"
                      onClick={(e) => {
                        e.stopPropagation()
                        setStep((s) => Math.min(stepMeta.lastStep, s + 1))
                      }}
                    >
                      Próximo
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="md"
                      disabled={flow === 'mission' && isGeneratingKmz}
                      className="min-w-[min(100%,11rem)] border border-neutral-200 bg-neutral-100 text-neutral-900 hover:border-white hover:bg-white hover:text-neutral-950 sm:min-w-[11rem]"
                      onClick={() => runConfirm()}
                    >
                      {flow === 'calibration'
                        ? 'Concluir'
                        : isGeneratingKmz
                          ? 'Gerando…'
                          : 'Confirmar e baixar KMZ'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function CheckRow({ item, checked, onChange }: { item: ChecklistItemDef; checked: boolean; onChange: (v: boolean) => void }) {
  const id = `pf-${item.id}`.replaceAll(/[^a-zA-Z0-9-]/g, '-')
  return (
    <label
      htmlFor={id}
      className={cn(
        'block cursor-pointer rounded-md border p-2.5 transition',
        checked ? 'border-primary-500/30 bg-primary-500/5' : 'border-white/10 bg-black/15 hover:border-white/20',
      )}
    >
      <div className="flex items-start gap-2">
        <input
          id={id}
          type="checkbox"
          className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border border-neutral-600"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>
          <span className="text-sm leading-snug text-neutral-200">{item.label}</span>
          {item.sub ? <span className="mt-0.5 block text-[11px] leading-snug text-neutral-500">{item.sub}</span> : null}
        </span>
      </div>
    </label>
  )
}
