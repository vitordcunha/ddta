import { useEffect } from 'react'
import type { Map as MapboxMap } from 'mapbox-gl'
import type { MapMode } from '@/features/map-engine/types'

const DEM_SOURCE_ID = 'dronedata-mapbox-dem'
const SKY_LAYER_ID = 'dronedata-sky'
const BUILDINGS_LAYER_ID = 'dronedata-3d-buildings'

function remove3dStyle(map: MapboxMap) {
  if (map.getLayer(BUILDINGS_LAYER_ID)) map.removeLayer(BUILDINGS_LAYER_ID)
  if (map.getLayer(SKY_LAYER_ID)) map.removeLayer(SKY_LAYER_ID)
  map.setTerrain(null)
  if (map.getSource(DEM_SOURCE_ID)) map.removeSource(DEM_SOURCE_ID)
}

function apply3dStyle(map: MapboxMap) {
  if (!map.getSource(DEM_SOURCE_ID)) {
    map.addSource(DEM_SOURCE_ID, {
      type: 'raster-dem',
      url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
      tileSize: 512,
      maxzoom: 14,
    })
  }
  map.setTerrain({ source: DEM_SOURCE_ID, exaggeration: 1.2 })

  if (!map.getLayer(SKY_LAYER_ID)) {
    map.addLayer({
      id: SKY_LAYER_ID,
      type: 'sky',
      paint: {
        'sky-type': 'atmosphere',
        'sky-atmosphere-sun': [0.0, 90.0],
        'sky-atmosphere-sun-intensity': 12,
      },
    })
  }

  if (!map.getLayer(BUILDINGS_LAYER_ID)) {
    map.addLayer({
      id: BUILDINGS_LAYER_ID,
      source: 'composite',
      'source-layer': 'building',
      filter: ['==', ['get', 'extrude'], 'true'],
      type: 'fill-extrusion',
      minzoom: 14,
      paint: {
        'fill-extrusion-color': '#9ca3af',
        'fill-extrusion-height': [
          'interpolate',
          ['linear'],
          ['zoom'],
          14,
          0,
          14.05,
          ['get', 'height'],
        ],
        'fill-extrusion-base': [
          'interpolate',
          ['linear'],
          ['zoom'],
          14,
          0,
          14.05,
          ['get', 'min_height'],
        ],
        'fill-extrusion-opacity': 0.65,
      },
    })
  }
}

type Props = {
  map: MapboxMap | null
  mode: MapMode
}

/** Terreno raster-dem, camada sky e prédios (fill-extrusion) em modo 3D; limpa em 2D. */
export function MapboxLayers({ map, mode }: Props) {
  useEffect(() => {
    if (!map) return

    const run = () => {
      if (mode === '3d') apply3dStyle(map)
      else remove3dStyle(map)
    }

    if (map.isStyleLoaded()) {
      run()
    } else {
      map.once('load', run)
    }

    const onStyleLoad = () => {
      if (mode === '3d') apply3dStyle(map)
    }
    map.on('style.load', onStyleLoad)

    return () => {
      map.off('load', run)
      map.off('style.load', onStyleLoad)
      if (map.isStyleLoaded()) remove3dStyle(map)
    }
  }, [map, mode])

  return null
}
