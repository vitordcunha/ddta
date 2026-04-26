import { ScatterplotLayer } from '@deck.gl/layers'
import type { Waypoint } from '@/features/flight-planner/types/waypoint'
import { waypointDisplayAltitudeMeters } from '@/features/map-engine/layers/waypointDisplayAltitude'

type WaypointDatum = {
  id: string
  position: [number, number, number]
  fillColor: [number, number, number, number]
}

function fillColorFor(index: number, total: number): [number, number, number, number] {
  if (total <= 1) return [250, 250, 250, 255]
  if (index === 0) return [34, 197, 94, 255]
  if (index === total - 1) return [239, 68, 68, 255]
  return [250, 250, 250, 255]
}

export function createWaypointLayer(
  waypointsSorted: Waypoint[],
  selectedWaypointId?: string | null,
): ScatterplotLayer {
  const total = waypointsSorted.length
  const data: WaypointDatum[] = waypointsSorted.map((w, i) => ({
    id: w.id,
    position: [w.lng, w.lat, waypointDisplayAltitudeMeters(w)],
    fillColor: fillColorFor(i, total),
  }))

  // Lightweight position hash: avoids full GPU buffer re-upload when only
  // the selection changes (and vice-versa for colors).
  const posHash = `${total},${waypointsSorted[0]?.lat ?? 0},${waypointsSorted[total - 1]?.lat ?? 0}`

  return new ScatterplotLayer({
    id: 'waypoints',
    data,
    getPosition: (d: WaypointDatum) => d.position,
    getFillColor: (d: WaypointDatum) => d.fillColor,
    getRadius: 4,
    radiusUnits: 'pixels',
    pickable: true,
    updateTriggers: {
      getPosition: posHash,
      getFillColor: [posHash, selectedWaypointId ?? ''],
    },
  })
}
