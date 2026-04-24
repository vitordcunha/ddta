import { useMemo, useState } from 'react'
import * as turf from '@turf/turf'
import type { Feature, Polygon } from 'geojson'

type LeafletLayer = {
  toGeoJSON: () => Feature
}

type DrawEvent = {
  layer: LeafletLayer
  layers?: {
    eachLayer: (handler: (layer: LeafletLayer) => void) => void
  }
}

function asPolygonFeature(feature: Feature | null): Feature<Polygon> | null {
  if (!feature || feature.geometry.type !== 'Polygon') {
    return null
  }
  return feature as Feature<Polygon>
}

export function usePolygonDraw() {
  const [polygon, setPolygon] = useState<Feature<Polygon> | null>(null)

  const handleCreated = (event: DrawEvent) => {
    const created = asPolygonFeature(event.layer.toGeoJSON())
    if (created) setPolygon(created)
  }

  const handleEdited = (event: DrawEvent) => {
    if (!event.layers) return
    event.layers.eachLayer((layer) => {
      const edited = asPolygonFeature(layer.toGeoJSON())
      if (edited) setPolygon(edited)
    })
  }

  const handleDeleted = () => {
    setPolygon(null)
  }

  const reset = () => {
    setPolygon(null)
  }

  const polygonArea = useMemo(() => (polygon ? turf.area(polygon) : null), [polygon])

  return {
    polygon,
    setPolygon,
    handleCreated,
    handleEdited,
    handleDeleted,
    reset,
    hasPolygon: polygon !== null,
    polygonArea,
  }
}
