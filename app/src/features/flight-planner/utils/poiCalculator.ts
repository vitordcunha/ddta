import * as turf from '@turf/turf'
import type { PointOfInterest } from '@/features/flight-planner/types/poi'
import type { Waypoint } from '@/features/flight-planner/types/waypoint'

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

function waypointAmslMeters(w: Waypoint): number {
  if (w.altitudeMode === 'amsl') return w.altitude
  const g = w.terrainElevation ?? 0
  return g + w.altitude
}

/**
 * Bearing geodésico (heading 0–359) e gimbal pitch para apontar do waypoint ao POI.
 * pitch = -atan2(Δalt, distância_horizontal) com Δalt = poi.altitude − altitude AMSL do waypoint.
 */
export function headingAndGimbalTowardPoi(
  waypoint: Waypoint,
  poi: PointOfInterest,
): { heading: number; gimbalPitch: number } {
  const from = turf.point([waypoint.lng, waypoint.lat])
  const to = turf.point([poi.lng, poi.lat])
  let heading = turf.bearing(from, to)
  heading = ((heading % 360) + 360) % 360

  const horizM = turf.distance(from, to, { units: 'meters' })
  const wpAmsl = waypointAmslMeters(waypoint)
  const deltaAlt = poi.altitude - wpAmsl
  let gimbalPitch = -90
  if (horizM >= 0.25) {
    gimbalPitch = (-Math.atan2(deltaAlt, horizM) * 180) / Math.PI
  }
  gimbalPitch = clamp(gimbalPitch, -90, 30)

  return { heading, gimbalPitch }
}

/** Atualiza heading/gimbal de todos os waypoints sem `poiOverride`. */
export function applyPoiAttitudeToWaypoints(
  waypoints: Waypoint[],
  poi: PointOfInterest | null,
): Waypoint[] {
  if (!poi) return waypoints
  return waypoints.map((w) => {
    if (w.poiOverride) return w
    const { heading, gimbalPitch } = headingAndGimbalTowardPoi(w, poi)
    return { ...w, heading, gimbalPitch }
  })
}
