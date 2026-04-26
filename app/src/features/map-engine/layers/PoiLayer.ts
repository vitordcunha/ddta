import { ScatterplotLayer } from '@deck.gl/layers'
import type { PointOfInterest } from '@/features/flight-planner/types/poi'

type PoiDatum = PointOfInterest & { position: [number, number, number] }

export function createPoiLayer(poi: PointOfInterest): ScatterplotLayer {
  const data: PoiDatum[] = [
    {
      ...poi,
      position: [poi.lng, poi.lat, poi.altitude],
    },
  ]
  return new ScatterplotLayer({
    id: 'poi-marker',
    data,
    pickable: true,
    getPosition: (d: PoiDatum) => d.position,
    getFillColor: [6, 182, 212, 230],
    getRadius: 9,
    radiusUnits: 'pixels',
  })
}
