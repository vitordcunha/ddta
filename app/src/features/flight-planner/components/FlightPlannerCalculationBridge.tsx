import { useEffect, useMemo, useRef } from 'react'
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
 */
export function FlightPlannerCalculationBridge() {
  const polygon = useFlightStore((s) => s.polygon)
  const params = useFlightStore((s) => s.params)
  const routeStartRef = useFlightStore((s) => s.routeStartRef)
  const terrainFollowing = useFlightStore((s) => s.terrainFollowing)
  const setResult = useFlightStore((s) => s.setResult)
  const setIsCalculating = useFlightStore((s) => s.setIsCalculating)
  const setTerrainLoading = useFlightStore((s) => s.setTerrainLoading)

  const { mapboxToken } = useMapEngine()
  const { data: droneCatalog } = useDroneModelsQuery()
  const elevation = useMemo(
    () => createMapboxElevationService(mapboxToken),
    [mapboxToken],
  )

  const base = useFlightCalculator(polygon, params, routeStartRef, droneCatalog)
  const baseRef = useRef(base)
  baseRef.current = base

  const localSerial = useRef(0)

  useEffect(() => {
    setIsCalculating(base.isCalculating)
  }, [base.isCalculating, setIsCalculating])

  useEffect(() => {
    const { waypoints, stats, strips, isCalculating: isDebouncing } = base

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

  return null
}
