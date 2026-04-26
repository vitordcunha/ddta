import type { Waypoint } from '@/features/flight-planner/types/waypoint'

/** Altitude em metros para desenho 3D (AMSL efetivo aproximado). */
export function waypointDisplayAltitudeMeters(w: Waypoint): number {
  if (w.altitudeMode === 'amsl') return w.altitude
  const terrain = w.terrainElevation ?? 0
  return terrain + w.altitude
}
