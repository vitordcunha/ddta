import { useMemo } from 'react'
import type { Feature, Polygon } from 'geojson'
import { useDebounce } from '@/hooks/useDebounce'
import { getDroneSpec } from '@/features/flight-planner/utils/droneSpecs'
import {
  calculateFootprint,
  calculateGsd,
  calculateSpacings,
  calculateStats,
  generateFlightGrid,
  generateWaypoints,
} from '@/features/flight-planner/utils/waypointCalculator'
import type { FlightParams } from '@/features/flight-planner/types'

export function useFlightCalculator(polygon: Feature<Polygon> | null, params: FlightParams) {
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
    const strips = generateFlightGrid(polygon, spacings, debouncedParams.rotationDeg)
    const waypoints = generateWaypoints(strips, debouncedParams.altitudeM)
    const stats = calculateStats(waypoints, polygon, debouncedParams, strips)

    return {
      waypoints,
      strips,
      stats,
      isCalculating,
    }
  }, [debouncedParams, isCalculating, polygon])

  return result
}
