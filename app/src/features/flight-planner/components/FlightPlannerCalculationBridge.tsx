import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useMapEngine } from '@/features/map-engine/useMapEngine'
import { useFlightCalculator } from '@/features/flight-planner/hooks/useFlightCalculator'
import { useDroneModelsQuery } from '@/features/flight-planner/hooks/useDroneModelsQuery'
import { createMapboxElevationService } from '@/features/flight-planner/services/elevationService'
import { useFlightStore } from '@/features/flight-planner/stores/useFlightStore'
import { applyPoiAttitudeToWaypoints } from '@/features/flight-planner/utils/poiCalculator'
import { applyTerrainToWaypoints } from '@/features/flight-planner/utils/terrainFollowingApply'

const ELEVATION_DEBOUNCE_MS = 300

/**
 * Mantem waypoints/strips/estatisticas sincronizados com poligono + parametros
 * mesmo quando o painel de configuracao esta recolhido.
 * Com terrain-following, aplica elevação Mapbox Terrain RGB sobre a rota.
 * Debounce de 300ms no fetch (O.8) para reduzir rajadas de tiles ao ajustar rota.
 * Módulo 6: intercepta recálculo quando há waypoints manuais para pedir confirmação.
 */
export function FlightPlannerCalculationBridge() {
  const polygon = useFlightStore((s) => s.polygon)
  const params = useFlightStore((s) => s.params)
  const routeStartRef = useFlightStore((s) => s.routeStartRef)

  // useDeferredValue mantém o mapa e inputs responsivos enquanto cálculos pesados correm em background.
  const deferredPolygon = useDeferredValue(polygon)
  const deferredParams = useDeferredValue(params)
  const deferredRouteStartRef = useDeferredValue(routeStartRef)
  const terrainFollowing = useFlightStore((s) => s.terrainFollowing)
  const setResult = useFlightStore((s) => s.setResult)
  const setIsCalculating = useFlightStore((s) => s.setIsCalculating)
  const setTerrainLoading = useFlightStore((s) => s.setTerrainLoading)
  const hasManualWaypoints = useFlightStore((s) => s.hasManualWaypoints)
  const clearManualWaypoints = useFlightStore((s) => s.clearManualWaypoints)

  const { mapboxToken } = useMapEngine()
  const { data: droneCatalog } = useDroneModelsQuery()
  const elevation = useMemo(
    () => createMapboxElevationService(mapboxToken),
    [mapboxToken],
  )

  const base = useFlightCalculator(deferredPolygon, deferredParams, deferredRouteStartRef, droneCatalog)
  // Atualizado via layout effect para evitar leitura de ref durante render.
  const baseRef = useRef(base)
  useLayoutEffect(() => {
    baseRef.current = base
  })

  const localSerial = useRef(0)

  useEffect(() => {
    setIsCalculating(base.isCalculating)
  }, [base.isCalculating, setIsCalculating])

  // Módulo 6: diálogo de confirmação de recálculo.
  // `recalcBlocked` permanece true após o usuário clicar "Manter edições manuais",
  // evitando que o effect de cálculo sobrescreva os waypoints até nova ação.
  const [showRecalcDialog, setShowRecalcDialog] = useState(false)
  const recalcBlockedRef = useRef(false)
  const prevParamsRef = useRef(params)

  useEffect(() => {
    if (!hasManualWaypoints) {
      // Waypoints manuais foram limpos: desbloqueia recálculo.
      recalcBlockedRef.current = false
      prevParamsRef.current = params
      return
    }
    if (prevParamsRef.current === params) return
    prevParamsRef.current = params
    // Params mudaram com waypoints manuais presentes: bloqueia e mostra diálogo.
    recalcBlockedRef.current = true
    setShowRecalcDialog(true)
  }, [params, hasManualWaypoints])

  useEffect(() => {
    const { waypoints, stats, strips, isCalculating: isDebouncing } = base

    // Bloqueia recálculo se o usuário escolheu manter edições manuais.
    if (recalcBlockedRef.current) return

    const withPoi = (wps: typeof waypoints) =>
      applyPoiAttitudeToWaypoints(wps, useFlightStore.getState().poi)

    if (!terrainFollowing) {
      setTerrainLoading(false)
      setResult(withPoi(waypoints), stats, strips)
      return
    }

    if (waypoints.length === 0) {
      setTerrainLoading(false)
      setResult(withPoi(waypoints), stats, strips)
      return
    }

    if (isDebouncing) {
      setTerrainLoading(false)
      setResult(withPoi(waypoints), stats, strips)
      return
    }

    setTerrainLoading(true)
    const t = window.setTimeout(() => {
      const snap = baseRef.current
      if (!useFlightStore.getState().terrainFollowing) {
        setTerrainLoading(false)
        return
      }
      if (snap.isCalculating) {
        setTerrainLoading(false)
        setResult(
          withPoi(snap.waypoints),
          snap.stats,
          snap.strips,
        )
        return
      }
      const wps2 = snap.waypoints
      if (wps2.length === 0) {
        setTerrainLoading(false)
        return
      }
      const my = ++localSerial.current
      const pts = wps2.map((w) => [w.lat, w.lng] as [number, number])
      const altM = useFlightStore.getState().params.altitudeM
      void elevation
        .getElevations(pts)
        .then((els) => {
          if (localSerial.current !== my) return
          const terr = applyTerrainToWaypoints(wps2, altM, els)
          setResult(
            withPoi(terr),
            snap.stats,
            snap.strips,
          )
        })
        .catch(() => {
          if (localSerial.current !== my) return
          const zero = new Array(pts.length).fill(0)
          const terr = applyTerrainToWaypoints(wps2, altM, zero)
          setResult(withPoi(terr), snap.stats, snap.strips)
        })
        .finally(() => {
          if (localSerial.current === my) setTerrainLoading(false)
        })
    }, ELEVATION_DEBOUNCE_MS)
    return () => {
      window.clearTimeout(t)
    }
  }, [base, elevation, params.altitudeM, setResult, setTerrainLoading, terrainFollowing])

  if (!showRecalcDialog) return null

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recalc-dialog-title"
    >
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-white/10 bg-[#1a1a1a] p-6 shadow-2xl">
        <h2
          id="recalc-dialog-title"
          className="mb-2 text-base font-semibold text-[#fafafa]"
        >
          Recalcular waypoints?
        </h2>
        <p className="mb-5 text-sm text-[#b4b4b4]">
          Você alterou parâmetros de voo. Deseja recalcular todos os waypoints?
          As edições manuais serão perdidas.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            className="flex-1 rounded-xl border border-[#3ecf8e]/40 bg-[#3ecf8e]/10 px-4 py-2.5 text-sm font-medium text-[#3ecf8e] transition hover:bg-[#3ecf8e]/20"
            onClick={() => {
              recalcBlockedRef.current = false
              clearManualWaypoints()
              setShowRecalcDialog(false)
            }}
          >
            Recalcular tudo
          </button>
          <button
            type="button"
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-[#fafafa] transition hover:bg-white/10"
            onClick={() => setShowRecalcDialog(false)}
          >
            Manter edições manuais
          </button>
        </div>
      </div>
    </div>
  )
}
