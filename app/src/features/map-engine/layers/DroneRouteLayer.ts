import { PathLayer } from '@deck.gl/layers'
import type { Waypoint } from '@/features/flight-planner/types/waypoint'
import { waypointDisplayAltitudeMeters } from '@/features/map-engine/layers/waypointDisplayAltitude'

export function createDroneRouteLayer(waypointsSorted: Waypoint[]): PathLayer {
  const path = waypointsSorted.map(
    (w) =>
      [w.lng, w.lat, waypointDisplayAltitudeMeters(w)] as [number, number, number],
  )
  return new PathLayer({
    id: 'drone-route',
    data: [{ path }],
    getPath: (d: { path: [number, number, number][] }) => d.path,
    getColor: [255, 200, 0, 220],
    getWidth: 2,
    widthUnits: 'pixels',
    capRounded: true,
    jointRounded: true,
  })
}
