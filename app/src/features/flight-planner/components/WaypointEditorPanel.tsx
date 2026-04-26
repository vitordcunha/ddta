import { useCallback, useMemo, useRef } from 'react'
import { Navigation, X } from 'lucide-react'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useMapEngine } from '@/features/map-engine/useMapEngine'
import { createMapboxElevationService } from '@/features/flight-planner/services/elevationService'
import { useFlightStore } from '@/features/flight-planner/stores/useFlightStore'
import type { Waypoint } from '@/features/flight-planner/types/waypoint'
import { applyTerrainToWaypoints } from '@/features/flight-planner/utils/terrainFollowingApply'
import { waypointResetPatchFromStrips } from '@/features/flight-planner/utils/waypointEditorReset'

const ALT_MIN = 10
const ALT_MAX = 500
const GIMBAL_MIN = -90
const GIMBAL_MAX = 30

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

function normalizeHeading(deg: number): number {
  let h = deg % 360
  if (h < 0) h += 360
  return h
}

function aglToAmslM(w: Waypoint): number {
  if (w.altitudeMode === 'amsl') return w.altitude
  return (w.terrainElevation ?? 0) + w.altitude
}

export function WaypointEditorPanel() {
  const selectedId = useFlightStore((s) => s.selectedWaypointId)
  const setSelectedWaypoint = useFlightStore((s) => s.setSelectedWaypoint)
  const waypoints = useFlightStore((s) => s.waypoints)
  const updateWaypoint = useFlightStore((s) => s.updateWaypoint)
  const copyAttitudeFromWaypointToAll = useFlightStore((s) => s.copyAttitudeFromWaypointToAll)
  const strips = useFlightStore((s) => s.strips)
  const params = useFlightStore((s) => s.params)
  const setResult = useFlightStore((s) => s.setResult)
  const { mapboxToken } = useMapEngine()

  const wp = useMemo(
    () => (selectedId ? waypoints.find((w) => w.id === selectedId) : undefined),
    [selectedId, waypoints],
  )

  const terrainRefreshRef = useRef(0)
  const terrainDebounceT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refreshTerrainIfNeeded = useCallback(() => {
    if (!useFlightStore.getState().terrainFollowing) return
    if (terrainDebounceT.current) {
      clearTimeout(terrainDebounceT.current)
      terrainDebounceT.current = null
    }
    terrainDebounceT.current = setTimeout(() => {
      terrainDebounceT.current = null
      if (!useFlightStore.getState().terrainFollowing) return
      const serial = ++terrainRefreshRef.current
      const svc = createMapboxElevationService(mapboxToken)
      const pts = useFlightStore.getState().waypoints.map((w) => [w.lat, w.lng] as [number, number])
      if (pts.length === 0) return
      void (async () => {
        try {
          const els = await svc.getElevations(pts)
          if (terrainRefreshRef.current !== serial) return
          const { waypoints: wps, stats: st, strips: stp, params: p } = useFlightStore.getState()
          setResult(applyTerrainToWaypoints(wps, p.altitudeM, els), st, stp)
        } catch {
          if (terrainRefreshRef.current !== serial) return
          const { waypoints: wps, stats: st, strips: stp, params: p } = useFlightStore.getState()
          const zero = new Array(wps.length).fill(0)
          setResult(applyTerrainToWaypoints(wps, p.altitudeM, zero), st, stp)
        }
      })()
    }, 300)
  }, [mapboxToken, setResult])

  if (!selectedId || !wp) return null

  const onClose = () => setSelectedWaypoint(null)

  const patchAltitude = (alt: number) => {
    const v = clamp(alt, ALT_MIN, ALT_MAX)
    updateWaypoint(wp.id, { altitude: v })
  }

  const setAltitudeMode = (mode: 'agl' | 'amsl') => {
    if (mode === wp.altitudeMode) return
    const terrain = wp.terrainElevation ?? 0
    if (mode === 'amsl') {
      const amsl = aglToAmslM(wp)
      updateWaypoint(wp.id, { altitudeMode: 'amsl', altitude: amsl, manualAltitude: true })
    } else {
      const amsl = aglToAmslM(wp)
      const agl = Math.max(ALT_MIN, amsl - terrain)
      updateWaypoint(wp.id, { altitudeMode: 'agl', altitude: agl, manualAltitude: true })
    }
    void refreshTerrainIfNeeded()
  }

  const onReset = () => {
    const patch = waypointResetPatchFromStrips(strips, params.altitudeM, wp.index)
    if (!patch) return
    updateWaypoint(wp.id, { ...patch, manualAltitude: false })
    void refreshTerrainIfNeeded()
  }

  const onApplyAttitudeToAll = () => {
    copyAttitudeFromWaypointToAll(wp.id)
  }

  return (
    <div
      className={cn(
        'pointer-events-auto flex max-h-[min(85svh,640px)] w-[min(100%,20rem)] flex-col overflow-hidden',
        'rounded-xl border border-white/12 bg-[#121212]/95 shadow-2xl backdrop-blur-md',
      )}
      role="dialog"
      aria-label="Editor de waypoint"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <h2 className="text-sm font-semibold text-neutral-100">Waypoint #{wp.index + 1}</h2>
        <button
          type="button"
          onClick={onClose}
          className="touch-target flex size-9 items-center justify-center rounded-lg text-neutral-400 hover:bg-white/5 hover:text-white"
          title="Fechar"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden p-3 text-xs text-neutral-300 [scrollbar-gutter:stable]">
        <Field label="Índice">
          <span className="font-mono text-neutral-200">{wp.index}</span>
        </Field>

        <Field label="Latitude (°)">
          <input
            type="number"
            step="any"
            className="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1.5 font-mono text-neutral-100"
            value={Number.isFinite(wp.lat) ? wp.lat : ''}
            onChange={(e) => {
              const v = parseFloat(e.target.value)
              if (!Number.isFinite(v)) return
              updateWaypoint(wp.id, { lat: clamp(v, -90, 90) })
            }}
            onBlur={() => void refreshTerrainIfNeeded()}
          />
        </Field>

        <Field label="Longitude (°)">
          <input
            type="number"
            step="any"
            className="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1.5 font-mono text-neutral-100"
            value={Number.isFinite(wp.lng) ? wp.lng : ''}
            onChange={(e) => {
              const v = parseFloat(e.target.value)
              if (!Number.isFinite(v)) return
              updateWaypoint(wp.id, { lng: clamp(v, -180, 180) })
            }}
            onBlur={() => void refreshTerrainIfNeeded()}
          />
        </Field>

        <Field label={`Altitude (${wp.altitudeMode.toUpperCase()})`}>
          <div className="flex flex-col gap-2">
            <input
              type="range"
              min={ALT_MIN}
              max={ALT_MAX}
              step={1}
              value={clamp(wp.altitude, ALT_MIN, ALT_MAX)}
              onChange={(e) => patchAltitude(Number(e.target.value))}
              className="h-2 w-full cursor-pointer accent-[#3ecf8e]"
            />
            <input
              type="number"
              min={ALT_MIN}
              max={ALT_MAX}
              className="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1.5 font-mono text-neutral-100"
              value={wp.altitude}
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                if (!Number.isFinite(v)) return
                patchAltitude(v)
              }}
            />
          </div>
        </Field>

        <Field label="Modo altitude">
          <div className="flex rounded-lg border border-white/10 p-0.5">
            {(['agl', 'amsl'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setAltitudeMode(m)}
                className={cn(
                  'flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide',
                  wp.altitudeMode === m
                    ? 'bg-[#3ecf8e]/20 text-[#3ecf8e]'
                    : 'text-neutral-500 hover:text-neutral-300',
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Elevação terreno (m)">
          <span className="font-mono text-neutral-400">
            {wp.terrainElevation != null && Number.isFinite(wp.terrainElevation)
              ? wp.terrainElevation.toFixed(1)
              : '—'}
          </span>
        </Field>

        <Field label={`Gimbal pitch (${wp.gimbalPitch.toFixed(0)}°)`}>
          <input
            type="range"
            min={GIMBAL_MIN}
            max={GIMBAL_MAX}
            step={1}
            value={clamp(wp.gimbalPitch, GIMBAL_MIN, GIMBAL_MAX)}
            onChange={(e) =>
              updateWaypoint(wp.id, { gimbalPitch: Number(e.target.value) })
            }
            className="h-2 w-full cursor-pointer accent-[#60A5FA]"
          />
        </Field>

        <Field label="Heading (°)">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={359}
              step={1}
              className="min-w-0 flex-1 rounded-md border border-white/15 bg-black/30 px-2 py-1.5 font-mono text-neutral-100"
              value={Math.round(normalizeHeading(wp.heading))}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10)
                if (!Number.isFinite(v)) return
                updateWaypoint(wp.id, { heading: normalizeHeading(v) })
              }}
            />
            <div
              className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/40"
              title="Sentido do heading"
            >
              <Navigation
                className="size-5 text-[#3ecf8e]"
                style={{ transform: `rotate(${normalizeHeading(wp.heading)}deg)` }}
                aria-hidden
              />
            </div>
          </div>
        </Field>

        <Field label="Sobrescrever POI">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={wp.poiOverride}
              onChange={(e) => updateWaypoint(wp.id, { poiOverride: e.target.checked })}
              className="size-4 rounded border border-white/20 bg-white/[0.04]"
            />
            <span className="text-neutral-500">Ignora POI global neste ponto</span>
          </label>
        </Field>

        <Field label="Velocidade (m/s, opcional)">
          <input
            type="number"
            step="0.1"
            min={0}
            className="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1.5 font-mono text-neutral-100"
            value={wp.speed ?? ''}
            placeholder="Padrão da missão"
            onChange={(e) => {
              const raw = e.target.value.trim()
              if (raw === '') {
                updateWaypoint(wp.id, { speed: undefined })
                return
              }
              const v = parseFloat(raw)
              if (!Number.isFinite(v) || v < 0) return
              updateWaypoint(wp.id, { speed: v })
            }}
          />
        </Field>

        <Field label="Pausa (s)">
          <input
            type="number"
            step="0.5"
            min={0}
            className="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1.5 font-mono text-neutral-100"
            value={wp.hoverTime ?? ''}
            placeholder="0"
            onChange={(e) => {
              const raw = e.target.value.trim()
              if (raw === '') {
                updateWaypoint(wp.id, { hoverTime: undefined })
                return
              }
              const v = parseFloat(raw)
              if (!Number.isFinite(v) || v < 0) return
              updateWaypoint(wp.id, { hoverTime: v })
            }}
          />
        </Field>
      </div>

      <div className="shrink-0 space-y-2 border-t border-white/10 p-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-full text-xs"
          onClick={onApplyAttitudeToAll}
        >
          Aplicar a todos
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-full text-xs"
          onClick={onReset}
        >
          Resetar
        </Button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">{label}</div>
      {children}
    </div>
  )
}
