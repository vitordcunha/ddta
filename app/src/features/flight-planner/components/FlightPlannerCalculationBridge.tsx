import { useEffect, useMemo, useRef } from 'react'
import { useMapEngine } from '@/features/map-engine/useMapEngine'
import { useFlightCalculator } from '@/features/flight-planner/hooks/useFlightCalculator'
import { createMapboxElevationService } from '@/features/flight-planner/services/elevationService'
import { useFlightStore } from '@/features/flight-planner/stores/useFlightStore'
import { applyPoiAttitudeToWaypoints } from '@/features/flight-planner/utils/poiCalculator'
import { applyTerrainToWaypoints } from '@/features/flight-planner/utils/terrainFollowingApply'

/**
 * Mantem waypoints/strips/estatisticas sincronizados com poligono + parametros
 * mesmo quando o painel de configuracao esta recolhido.
 * Com terrain-following, aplica elevação Mapbox Terrain RGB sobre a rota.
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
  const elevation = useMemo(
    () => createMapboxElevationService(mapboxToken),
    [mapboxToken],
  )

  const base = useFlightCalculator(polygon, params, routeStartRef)
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

    const my = ++localSerial.current
    setTerrainLoading(true)
    const pts = waypoints.map((w) => [w.lat, w.lng] as [number, number])
    void elevation
      .getElevations(pts)
      .then((els) => {
        if (localSerial.current !== my) return
        const terr = applyTerrainToWaypoints(waypoints, params.altitudeM, els)
        setResult(withPoi(terr), stats, strips)
      })
      .catch(() => {
        if (localSerial.current !== my) return
        const zero = new Array(pts.length).fill(0)
        const terr = applyTerrainToWaypoints(waypoints, params.altitudeM, zero)
        setResult(withPoi(terr), stats, strips)
      })
      .finally(() => {
        if (localSerial.current === my) setTerrainLoading(false)
      })
  }, [base, elevation, params.altitudeM, setResult, setTerrainLoading, terrainFollowing])

  return null
}
