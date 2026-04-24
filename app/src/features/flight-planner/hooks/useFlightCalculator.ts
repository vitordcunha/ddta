import { useMemo } from 'react'
import type { Feature, Polygon } from 'geojson'
import { useDebounce } from '@/hooks/useDebounce'
import type { RouteStartRef } from '@/features/flight-planner/stores/useFlightStore'
import { getDroneSpec } from '@/features/flight-planner/utils/droneSpecs'
import {
  calculateFootprint,
  calculateGsd,
  calculateSpacings,
  calculateStats,
  generateFlightGrid,
  generateWaypoints,
  optimizeFlightPlanStart,
} from '@/features/flight-planner/utils/waypointCalculator'
import type { FlightParams } from '@/features/flight-planner/types'

export function useFlightCalculator(
  polygon: Feature<Polygon> | null,
  params: FlightParams,
  routeStartRef: RouteStartRef | null,
) {
  const debouncedParams = useDebounce(params, 400)
  const isCalculating = params !== debouncedParams

  const result = useMemo(() => {
    if (!polygon) {
      return { waypoints: [], strips: [], stats: null, isCalculating }
    }

    const specs = getDroneSpec(debouncedParams.droneModel)
    const gsdM = calculateGsd(debouncedParams.altitudeM, specs)
    const footprint = calculateFootprint(gsdM, specs)
    const spacings = calculateSpacings(footprint, debouncedParams.forwardOverlap, debouncedParams.sideOverlap)

    const { strips, waypoints } =
      routeStartRef != null
        ? optimizeFlightPlanStart(
            polygon,
            spacings,
            debouncedParams.rotationDeg,
            debouncedParams.altitudeM,
            routeStartRef,
          )
        : (() => {
            const s = generateFlightGrid(polygon, spacings, debouncedParams.rotationDeg)
            return { strips: s, waypoints: generateWaypoints(s, debouncedParams.altitudeM) }
          })()

    const stats = calculateStats(waypoints, polygon, debouncedParams, strips)

    return {
      waypoints,
      strips,
      stats,
      isCalculating,
    }
  }, [debouncedParams, isCalculating, polygon, routeStartRef])

  return result
}
