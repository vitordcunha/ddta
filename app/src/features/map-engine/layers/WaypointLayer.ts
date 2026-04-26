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

export function createWaypointLayer(waypointsSorted: Waypoint[]): ScatterplotLayer {
  const total = waypointsSorted.length
  const data: WaypointDatum[] = waypointsSorted.map((w, i) => ({
    id: w.id,
    position: [w.lng, w.lat, waypointDisplayAltitudeMeters(w)],
    fillColor: fillColorFor(i, total),
  }))

  return new ScatterplotLayer({
    id: 'waypoints',
    data,
    getPosition: (d: WaypointDatum) => d.position,
    getFillColor: (d: WaypointDatum) => d.fillColor,
    getRadius: 4,
    radiusUnits: 'pixels',
    pickable: true,
  })
}
