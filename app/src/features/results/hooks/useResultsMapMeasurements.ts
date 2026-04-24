import { useMemo } from 'react'
import * as turf from '@turf/turf'
import { useResultsViewStore } from '@/features/results/stores/useResultsViewStore'

export function useResultsMapMeasurements() {
  const distancePoints = useResultsViewStore((s) => s.distancePoints)
  const areaPoints = useResultsViewStore((s) => s.areaPoints)
  const elevationPoint = useResultsViewStore((s) => s.elevationPoint)

  return useMemo(() => {
    let distanceResult: string | null = null
    if (distancePoints.length >= 2) {
      const line = turf.lineString(
        distancePoints.map(([lat, lon]) => [lon, lat]),
      )
      const km = turf.length(line, { units: 'kilometers' })
      distanceResult =
        km >= 1
          ? `${km.toFixed(3).replace('.', ',')} km`
          : `${(km * 1000).toFixed(2).replace('.', ',')} m`
    }
    let areaResult: string | null = null
    if (areaPoints.length > 2) {
      const ring = [...areaPoints, areaPoints[0]!].map(([lat, lon]) => [lon, lat])
      const poly = turf.polygon([ring])
      const m2 = turf.area(poly)
      const ha = m2 / 10000
      areaResult = `${m2.toFixed(1).replace('.', ',')} m2 (${ha.toFixed(2).replace('.', ',')} ha)`
    }
    return { distanceResult, areaResult, elevationPoint }
  }, [areaPoints, distancePoints, elevationPoint])
}
