import type { Waypoint } from '@/features/flight-planner/types/waypoint'

/**
 * Aplica AGL (altura de voo) + elevação do terreno = AMSL absoluta do waypoint.
 * Waypoints com `manualAltitude` conservam a altitude, mas recebem `terrainElevation` atualizado.
 */
export function applyTerrainToWaypoints(
  waypoints: Waypoint[],
  aglM: number,
  elevations: number[],
): Waypoint[] {
  return waypoints.map((w, i) => {
    const el = elevations[i] ?? 0
    if (w.manualAltitude) {
      return {
        ...w,
        terrainElevation: el,
      }
    }
    return {
      ...w,
      terrainElevation: el,
      altitude: el + aglM,
      altitudeMode: 'amsl' as const,
    }
  })
}
