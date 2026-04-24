import { type ReactNode, useEffect, useMemo, useState } from 'react'
import * as turf from '@turf/turf'
import {
  Check,
  Cloud,
  CloudRain,
  Compass,
  Download,
  Droplets,
  Gauge,
  Info,
  Loader2,
  MapPin,
  Moon,
  Sun,
  Thermometer,
  TriangleAlert,
  Umbrella,
  Wind,
} from 'lucide-react'
import { Badge, Button, Card } from '@/components/ui'
import { useKmzExport } from '@/features/flight-planner/hooks/useKmzExport'
import { useWeather } from '@/features/flight-planner/hooks/useWeather'
import { getDroneOptions } from '@/features/flight-planner/utils/droneSpecs'
import {
  windDegToCompass,
  wmoCodeToConditionPt,
} from '@/features/flight-planner/utils/weatherHelpers'
import { useFlightStore } from '@/features/flight-planner/stores/useFlightStore'
import type { PersistedFlightPlan } from '@/features/flight-planner/stores/useFlightStore'
import {
  clearFlightPlanDraft,
  readFlightPlanDraft,
  writeFlightPlanDraft,
} from '@/features/flight-planner/utils/flightPlanDraftStorage'
import { useGeolocation } from '@/hooks/useGeolocation'
import {
  analyzeFlightConfiguration,
  detectActiveQualityPreset,
  estimateGsdCmFromParams,
  FLIGHT_QUALITY_PRESETS,
  presetParamsFor,
} from '@/features/flight-planner/utils/flightParamGuidance'
import type { FlightQualityPresetId } from '@/features/flight-planner/utils/flightParamGuidance'

type Props = {
  projectName: string
  projectId: string
  initialPlan: PersistedFlightPlan | null
  onSavePlan: (plan: PersistedFlightPlan) => void | Promise<void>
}

const format = {
  number: (value: number, digits = 1) => value.toFixed(digits).replace('.', ','),
}

export function FlightPlannerConfigPanel({ projectName, projectId, initialPlan, onSavePlan }: Props) {
  const {
    polygon,
    params,
    waypoints,
    stats,
    weather,
    assessment,
    isCalculating,
    setParams,
    setWeather,
    loadPlan,
    resetPlan,
    routeStartRef,
    setRouteStartRef,
  } = useFlightStore()
  const { locate, phase: geoPhase, error: geoError } = useGeolocation()
  const weatherQuery = useWeather(params.droneModel, params.altitudeM)
  const kmzExport = useKmzExport(projectName)
  const [saving, setSaving] = useState(false)
  const {
    fetchWeather,
    weather: currentWeather,
    assessment: currentAssessment,
    isLoading: isWeatherLoading,
    error: weatherError,
  } = weatherQuery

  useEffect(() => {
    const fromDraft = readFlightPlanDraft(projectId)
    if (fromDraft) {
      loadPlan(fromDraft)
      return
    }
    if (initialPlan) {
      loadPlan(initialPlan)
    } else {
      resetPlan()
    }
  }, [projectId, initialPlan, loadPlan, resetPlan])

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined
    const sub = useFlightStore.subscribe((state) => {
      if (t) clearTimeout(t)
      t = setTimeout(() => {
        if (!state.polygon && state.waypoints.length === 0) {
          clearFlightPlanDraft(projectId)
          return
        }
        writeFlightPlanDraft(projectId, {
          polygon: state.polygon,
          params: state.params,
          waypoints: state.waypoints,
          stats: state.stats,
          weather: state.weather,
          assessment: state.assessment,
        })
      }, 300)
    })
    return () => {
      if (t) clearTimeout(t)
      sub()
    }
  }, [projectId])

  useEffect(() => {
    if (!polygon) return
    const center = turf.centerOfMass(polygon).geometry.coordinates
    void fetchWeather(center[1], center[0])
  }, [fetchWeather, polygon])

  useEffect(() => {
    setWeather(currentWeather, currentAssessment)
  }, [currentAssessment, currentWeather, setWeather])

  const hasPlan = Boolean(polygon && waypoints.length > 0 && stats)

  const activeQualityPreset = useMemo(() => detectActiveQualityPreset(params), [params])

  const configNotices = useMemo(
    () =>
      analyzeFlightConfiguration(
        params,
        stats ? { gsdCm: stats.gsdCm, estimatedPhotos: stats.estimatedPhotos } : null,
      ),
    [params, stats],
  )

  const applyQualityPreset = (id: FlightQualityPresetId) => {
    setParams(presetParamsFor(id))
  }

  const saveCurrentPlan = async () => {
    if (saving) return
    const plan: PersistedFlightPlan = {
      polygon,
      params,
      waypoints,
      stats,
      weather,
      assessment,
    }
    setSaving(true)
    try {
      await Promise.resolve(onSavePlan(plan))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <Card className="glass-card space-y-3">
        <h3 className="text-sm font-medium text-neutral-200">Parametros de voo</h3>
        <div className="flex gap-2 rounded-lg border border-white/10 bg-black/25 p-2.5 text-[11px] leading-snug text-neutral-400">
          <Info className="mt-0.5 size-3.5 shrink-0 text-primary-400/90" aria-hidden />
          <div className="space-y-1.5">
            <p>
              O <span className="text-neutral-300">GSD</span> (Ground Sampling Distance) e o tamanho do pixel no
              solo: <span className="text-neutral-300">altura menor</span> aumenta o detalhe e o numero de fotos;{' '}
              <span className="text-neutral-300">sobreposicao maior</span> melhora a costura do ortomosaico e modelos
              3D, ao custo de tempo e bateria.
            </p>
            <p>
              GSD estimado com este drone e altitude:{' '}
              <span className="font-mono text-neutral-200">
                ~{format.number(estimateGsdCmFromParams(params), 2)} cm/px
              </span>
              {stats ? (
                <>
                  {' '}
                  (calculado na area:{' '}
                  <span className="font-mono text-neutral-200">{format.number(stats.gsdCm, 2)} cm/px</span>).
                </>
              ) : null}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">Perfil sugerido</p>
          <div className="flex flex-wrap gap-2">
            {FLIGHT_QUALITY_PRESETS.map((preset) => (
              <Button
                key={preset.id}
                type="button"
                size="sm"
                variant={activeQualityPreset === preset.id ? 'primary' : 'secondary'}
                className="text-xs"
                onClick={() => applyQualityPreset(preset.id)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <p className="text-[11px] leading-snug text-neutral-500">
            {activeQualityPreset
              ? FLIGHT_QUALITY_PRESETS.find((p) => p.id === activeQualityPreset)?.short
              : 'Valores personalizados: use os sliders e observe o GSD e os avisos abaixo.'}
          </p>
        </div>

        {configNotices.length > 0 ? (
          <ul className="space-y-1.5 rounded-lg border border-white/10 p-2.5 text-[11px] leading-snug">
            {configNotices.map((n) => (
              <li
                key={n.text}
                className={
                  n.severity === 'error'
                    ? 'flex gap-2 text-red-300/95'
                    : n.severity === 'warning'
                      ? 'flex gap-2 text-amber-200/90'
                      : 'flex gap-2 text-neutral-400'
                }
              >
                {n.severity === 'error' ? (
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                ) : n.severity === 'warning' ? (
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-300/80" aria-hidden />
                ) : (
                  <Info className="mt-0.5 size-3.5 shrink-0 text-neutral-500" aria-hidden />
                )}
                <span>{n.text}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <label className="grid gap-1 text-xs text-neutral-400">
          Drone
          <select
            className="input-base"
            value={params.droneModel}
            onChange={(event) =>
              setParams({
                droneModel: event.target.value as typeof params.droneModel,
              })
            }
          >
            {getDroneOptions().map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <p className="text-[11px] leading-snug text-neutral-500">
          Escolha o mesmo modelo que vai voar: o GSD e as estatisticas usam a largura focal e resolucao da camera
          cadastradas.
        </p>
        <Range
          label="Altitude"
          value={params.altitudeM}
          min={30}
          max={300}
          step={5}
          unit="m"
          hint="Altura em relacao ao ponto de decolagem (modo comum nos apps DJI). Relevo forte exige planejamento extra; confirme limites legais e autorizacoes na sua regiao."
          onChange={(v) => setParams({ altitudeM: v })}
        />
        <Range
          label="Sobreposicao frontal"
          value={params.forwardOverlap}
          min={60}
          max={95}
          step={1}
          unit="%"
          hint="Entre fotos na mesma faixa. Valores tipicos 70-85%. Terrenos sem textura (agua, neve) costumam precisar de mais sobreposicao."
          onChange={(v) => setParams({ forwardOverlap: v })}
        />
        <Range
          label="Sobreposicao lateral"
          value={params.sideOverlap}
          min={60}
          max={90}
          step={1}
          unit="%"
          hint="Entre faixas paralelas. Um pouco menor que a frontal e comum; muito baixa prejudica bordas e alinhamento."
          onChange={(v) => setParams({ sideOverlap: v })}
        />
        <Range
          label="Rotacao da grade"
          value={params.rotationDeg}
          min={0}
          max={180}
          step={1}
          unit="º"
          hint="Alinha as faixas ao formato da area, vento ou deslocamento. Tambem no mapa (barra lateral) ou com [ / ] no teclado."
          onChange={(v) => setParams({ rotationDeg: v })}
        />
        <Range
          label="Velocidade"
          value={params.speedMs}
          min={3}
          max={15}
          step={1}
          unit="m/s"
          hint="Mais lento tende a reduzir desfoque e estabilizar o intervalo entre fotos; mais rapido encurta a missao se o vento e a camera permitirem."
          onChange={(v) => setParams({ speedMs: v })}
        />
        <p className="text-[11px] leading-snug text-neutral-500/90">
          Estas sugestoes nao substituem o manual do drone, regras da ANAC ou condicoes locais de voo. Valide sempre no
          app de campo antes de decolar.
        </p>
      </Card>

      <Card className="glass-card space-y-2">
        <h3 className="text-sm font-medium text-neutral-200">Inicio da rota</h3>
        <p className="text-[11px] leading-snug text-neutral-500">
          Ajusta a ordem das faixas e o sentido do percurso para o primeiro waypoint ficar o mais
          proximo possivel da sua posicao (GPS do navegador).
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="inline-flex items-center gap-1.5"
            disabled={!polygon || geoPhase === 'loading'}
            onClick={() => {
              void locate().then((c) => setRouteStartRef({ lat: c.lat, lng: c.lng }))
            }}
          >
            {geoPhase === 'loading' ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <MapPin className="size-3.5" aria-hidden />
            )}
            Usar minha posicao
          </Button>
          {routeStartRef ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setRouteStartRef(null)}
            >
              Ordem padrao
            </Button>
          ) : null}
        </div>
        {routeStartRef ? (
          <p className="text-[11px] text-primary-300/90">
            Otimizacao ativa: inicio proximo de{' '}
            {routeStartRef.lat.toFixed(5)}, {routeStartRef.lng.toFixed(5)}.
          </p>
        ) : null}
        {geoError ? <p className="text-[11px] text-red-300/95">{geoError}</p> : null}
        {!polygon ? (
          <p className="text-[11px] text-neutral-500">Desenhe a area de voo no mapa para habilitar.</p>
        ) : null}
      </Card>

      <Card className="glass-card space-y-2">
        <h3 className="text-sm font-medium text-neutral-200">Estatisticas</h3>
        {stats ? (
          <>
            <p className="text-[11px] leading-snug text-neutral-500">
              GSD na area desenhada reflete a geometria media; use-o para comparar com o exigido pelo seu software de
              fotogrametria ou projeto.
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
            <Stat label="GSD" value={`${format.number(stats.gsdCm, 2)} cm/px`} />
            <Stat label="Area" value={`${format.number(stats.areaHa, 2)} ha`} />
            <Stat label="Waypoints" value={String(stats.waypointCount)} />
            <Stat label="Faixas" value={String(stats.stripCount)} />
            <Stat label="Fotos" value={String(stats.estimatedPhotos)} />
            <Stat label="Tempo" value={`${format.number(stats.estimatedTimeMin, 0)} min`} />
            <Stat label="Baterias" value={String(stats.batteryCount)} />
            <Stat label="Distancia" value={`${format.number(stats.distanceKm, 2)} km`} />
          </div>
          </>
        ) : (
          <p className="text-sm text-neutral-400">Desenhe uma area para calcular o plano.</p>
        )}
        {isCalculating && (
          <div className="inline-flex items-center gap-2 text-xs text-neutral-300">
            <Loader2 className="size-3 animate-spin" /> Recalculando...
          </div>
        )}
      </Card>

      <Card className="glass-card space-y-3">
        <h3 className="text-sm font-medium text-neutral-200">Clima e previsao</h3>
        {isWeatherLoading ? (
          <p className="text-sm text-neutral-400">Carregando clima...</p>
        ) : currentWeather ? (
          <>
            {currentAssessment ? (
              <div className="space-y-2">
                <Badge variant={currentAssessment.go ? 'success' : 'error'} className="inline-flex items-center gap-1">
                  {currentAssessment.go ? <Check className="size-3" /> : <TriangleAlert className="size-3" />}
                  {currentAssessment.go ? 'Condicoes adequadas para o perfil do drone' : 'Voo nao recomendado'}
                </Badge>
                {currentAssessment.issues.length > 0 ? (
                  <ul className="list-inside list-disc space-y-1 text-xs text-red-300/95">
                    {currentAssessment.issues.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                ) : null}
                {currentAssessment.warnings.length > 0 ? (
                  <ul className="list-inside list-disc space-y-1 text-xs text-amber-200/90">
                    {currentAssessment.warnings.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                ) : null}
                {currentAssessment.tips.length > 0 ? (
                  <ul className="list-inside list-disc space-y-1 text-xs text-neutral-400">
                    {currentAssessment.tips.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs">
              <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                Agora
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-neutral-100">
                  {currentWeather.conditionLabel ??
                    wmoCodeToConditionPt(currentWeather.weatherCode ?? 0)}
                </span>
                {currentWeather.isDay === false ? (
                  <span className="inline-flex items-center gap-0.5 rounded bg-neutral-800/80 px-1.5 py-0.5 text-[10px] text-neutral-300">
                    <Moon className="size-3" aria-hidden /> Noite
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 rounded bg-amber-950/50 px-1.5 py-0.5 text-[10px] text-amber-200/90">
                    <Sun className="size-3" aria-hidden /> Dia
                  </span>
                )}
              </div>
              <p className="mt-2 inline-flex items-center gap-1.5 text-neutral-200">
                <Umbrella className="size-3.5 shrink-0 text-sky-300" aria-hidden />
                <span className="font-medium">
                  {currentWeather.isPrecipitatingNow === true
                    ? 'Chovendo ou com precipitacao no momento'
                    : currentWeather.rainMmH > 0.05
                      ? 'Sem chuva forte agora, mas ha precipitacao medida'
                      : 'Sem precipitacao relevante no momento'}
                </span>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
              <Stat
                icon={<Thermometer className="size-3" />}
                label="Temperatura"
                value={`${format.number(currentWeather.temperatureC, 1)} ºC`}
              />
              <Stat
                icon={<Cloud className="size-3" />}
                label="Sensacao"
                value={
                  currentWeather.apparentTemperatureC != null
                    ? `${format.number(currentWeather.apparentTemperatureC, 1)} ºC`
                    : '—'
                }
              />
              <Stat
                icon={<Droplets className="size-3" />}
                label="Umidade"
                value={
                  currentWeather.relativeHumidityPct != null
                    ? `${currentWeather.relativeHumidityPct}%`
                    : '—'
                }
              />
              <Stat
                icon={<Gauge className="size-3" />}
                label="Pressao"
                value={
                  currentWeather.pressureHpa != null
                    ? `${format.number(currentWeather.pressureHpa, 1)} hPa`
                    : '—'
                }
              />
              <Stat
                icon={<CloudRain className="size-3" />}
                label="Nebulosidade"
                value={`${Math.round(currentWeather.cloudCoveragePct)}%`}
              />
              <Stat
                icon={<CloudRain className="size-3" />}
                label="Precip. (total)"
                value={`${format.number(currentWeather.rainMmH, 2)} mm/h`}
              />
              <Stat
                icon={<Wind className="size-3" />}
                label="Vento (10 m)"
                value={`${format.number(currentWeather.windSpeedMs, 1)} m/s`}
              />
              <Stat
                icon={<Wind className="size-3" />}
                label="Rajadas"
                value={
                  currentWeather.windGustsMs != null
                    ? `${format.number(currentWeather.windGustsMs, 1)} m/s`
                    : '—'
                }
              />
              <Stat
                icon={<Compass className="size-3" />}
                label="Direcao"
                value={`${windDegToCompass(currentWeather.windDirectionDeg)} (${Math.round(currentWeather.windDirectionDeg)}º)`}
              />
              {(currentWeather.rainMmHRaw != null || currentWeather.showersMmH != null) && (
                <>
                  <Stat
                    icon={<Droplets className="size-3" />}
                    label="Chuva (rain)"
                    value={
                      currentWeather.rainMmHRaw != null
                        ? `${format.number(currentWeather.rainMmHRaw, 2)} mm/h`
                        : '—'
                    }
                  />
                  <Stat
                    icon={<Droplets className="size-3" />}
                    label="Aguaceiros"
                    value={
                      currentWeather.showersMmH != null
                        ? `${format.number(currentWeather.showersMmH, 2)} mm/h`
                        : '—'
                    }
                  />
                </>
              )}
            </div>

            {currentWeather.hourlyForecast && currentWeather.hourlyForecast.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                  Proximas 24 horas (Open-Meteo)
                </p>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-white/10">
                  <table className="w-full text-left text-[11px] text-neutral-300">
                    <thead className="sticky top-0 bg-[#141414]/95 text-[10px] uppercase text-neutral-500">
                      <tr>
                        <th className="px-2 py-1.5 font-medium">Hora</th>
                        <th className="px-2 py-1.5 font-medium">Temp</th>
                        <th className="px-2 py-1.5 font-medium">Prob.</th>
                        <th className="px-2 py-1.5 font-medium">mm/h</th>
                        <th className="px-2 py-1.5 font-medium hidden min-[380px]:table-cell">Tempo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentWeather.hourlyForecast.map((h) => (
                        <tr
                          key={h.time}
                          className="border-t border-white/5 hover:bg-white/[0.04]"
                        >
                          <td className="whitespace-nowrap px-2 py-1 text-neutral-200">
                            {formatForecastHourLabel(h.time)}
                          </td>
                          <td className="px-2 py-1 font-mono tabular-nums">
                            {format.number(h.tempC, 0)}º
                          </td>
                          <td className="px-2 py-1 font-mono tabular-nums">{h.precipProbPct}%</td>
                          <td className="px-2 py-1 font-mono tabular-nums">
                            {format.number(h.precipMm, 2)}
                          </td>
                          <td className="hidden min-[380px]:table-cell px-2 py-1 text-neutral-400">
                            {wmoCodeToConditionPt(h.weatherCode)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-neutral-400">O clima aparece apos desenhar a area.</p>
        )}
      </Card>

      <Card className="glass-card space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void saveCurrentPlan()} disabled={!hasPlan || saving}>
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-3.5 animate-spin" />
                Salvando…
              </span>
            ) : (
              'Salvar plano'
            )}
          </Button>
          <Button variant="outline" onClick={() => kmzExport.generateAndDownload(waypoints, params)} disabled={!hasPlan || kmzExport.status === 'generating'}>
            <Download className="mr-1 size-4" />
            {kmzExport.status === 'generating' ? 'Gerando...' : 'Baixar KMZ'}
          </Button>
        </div>
        {weatherError ? <p className="text-xs text-red-400">{weatherError}</p> : null}
      </Card>
    </div>
  )
}

function Range({
  label,
  value,
  min,
  max,
  step,
  onChange,
  unit,
  hint,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  unit?: string
  hint?: string
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n))
  return (
    <div className="grid gap-1 text-xs text-neutral-400">
      <div className="flex items-center justify-between gap-2">
        <span>{label}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="touch-target flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-neutral-700 bg-neutral-950/80 text-lg text-neutral-100 hover:border-neutral-500"
            onClick={() => onChange(clamp(value - step))}
            title="Diminuir"
          >
            −
          </button>
          <input
            type="number"
            inputMode="decimal"
            className="input-base h-11 w-[4.25rem] shrink-0 px-1 text-center font-mono text-sm text-neutral-100"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => {
              const raw = e.target.value
              if (raw === "" || raw === "-") return
              const n = Number(raw)
              if (Number.isNaN(n)) return
              onChange(clamp(n))
            }}
            onBlur={(e) => {
              if (e.target.value === "" || Number.isNaN(Number(e.target.value)))
                onChange(clamp(value))
            }}
          />
          <span className="w-4 shrink-0 text-[11px] text-neutral-500">{unit ?? ''}</span>
          <button
            type="button"
            className="touch-target flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-neutral-700 bg-neutral-950/80 text-lg text-neutral-100 hover:border-neutral-500"
            onClick={() => onChange(clamp(value + step))}
            title="Aumentar"
          >
            +
          </button>
        </div>
      </div>
      <input
        className="w-full"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
      />
      {hint ? <p className="text-[11px] leading-snug text-neutral-500">{hint}</p> : null}
    </div>
  )
}

function formatForecastHourLabel(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="glass-stat">
      <p className="mb-1 inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-neutral-500">
        {icon}
        {label}
      </p>
      <p className="text-sm font-medium text-neutral-100">{value}</p>
    </div>
  )
}
