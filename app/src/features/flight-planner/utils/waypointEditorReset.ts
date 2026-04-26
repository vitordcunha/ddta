import type { Strip } from '@/features/flight-planner/types'
import type { Waypoint } from '@/features/flight-planner/types/waypoint'
import { generateWaypoints } from '@/features/flight-planner/utils/waypointCalculator'

/**
 * Valores do grid para um waypoint (mesma ordem que `generateWaypoints(strips, altitudeM)`).
 */
export function waypointResetPatchFromStrips(
  strips: Strip[],
  altitudeM: number,
  index: number,
): Partial<Waypoint> | null {
  const fresh = generateWaypoints(strips, altitudeM)
  const f = fresh[index]
  if (!f) return null
  return {
    lat: f.lat,
    lng: f.lng,
    altitude: f.altitude,
    altitudeMode: f.altitudeMode,
    gimbalPitch: f.gimbalPitch,
    heading: f.heading,
    poiOverride: false,
    manualAltitude: false,
    speed: undefined,
    hoverTime: undefined,
    terrainElevation: undefined,
  }
}
