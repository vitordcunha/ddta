import type { FlightParams } from '@/features/flight-planner/types'
import type { CalibrationRecommendation } from '@/services/projectsService'

/**
 * Agrega `param_changes` de várias recomendações: velocidade/altitude → menor valor
 * sugerido; overlaps → maior.
 */
export function mergeCalibrationParamChanges(recs: CalibrationRecommendation[]): Partial<FlightParams> {
  let bestSpeed: number | undefined
  let bestFwd: number | undefined
  let bestSide: number | undefined
  let bestAlt: number | undefined
  for (const r of recs) {
    for (const pc of r.param_changes) {
      const s = Number(pc.suggested)
      if (Number.isNaN(s)) continue
      switch (pc.field) {
        case 'speedMs':
          if (bestSpeed === undefined || s < bestSpeed) bestSpeed = s
          break
        case 'forwardOverlap':
          if (bestFwd === undefined || s > bestFwd) bestFwd = s
          break
        case 'sideOverlap':
          if (bestSide === undefined || s > bestSide) bestSide = s
          break
        case 'altitudeM':
          if (bestAlt === undefined || s < bestAlt) bestAlt = s
          break
        default:
          break
      }
    }
  }
  const o: Partial<FlightParams> = {}
  if (bestSpeed !== undefined) o.speedMs = bestSpeed
  if (bestFwd !== undefined) o.forwardOverlap = bestFwd
  if (bestSide !== undefined) o.sideOverlap = bestSide
  if (bestAlt !== undefined) o.altitudeM = bestAlt
  return o
}
