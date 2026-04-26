import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchRainViewerRadarTileUrlTemplate } from '@/components/map/weather/fetchRainViewerRadarTemplate'
import { isOwmWeatherMapLayer, owmMapTileSlug } from '@/components/map/weather/mapWeatherTypes'
import type { WorkspaceMapWeatherTilesProps } from '@/components/map/useWorkspaceMapWeather'
import { useFlightStore } from '@/features/flight-planner/stores/useFlightStore'
import type { MapMode } from '@/features/map-engine/types'

export type RadarOverlayStatus = 'idle' | 'loading' | 'ready' | 'error'

type GoogleMapsLayersProps = {
  map: google.maps.Map | null
  mode: MapMode
  nativeShowRoute: boolean
  nativeShowWaypoints: boolean
  weatherTiles: WorkspaceMapWeatherTilesProps
}

function clampOpacity(n: number): number {
  if (Number.isNaN(n)) return 0.62
  return Math.min(0.95, Math.max(0.22, n))
}

function clearPlannerFeatures(data: google.maps.Data) {
  const remove: google.maps.Data.Feature[] = []
  data.forEach((f) => {
    if (f.getProperty('ddSource') === 'planner') remove.push(f)
  })
  remove.forEach((f) => data.remove(f))
}

/** GeoJSON nativo (Data layer) em 2D + tiles meteorológicos em `overlayMapTypes`. */
export function GoogleMapsLayers({
  map,
  mode,
  nativeShowRoute,
  nativeShowWaypoints,
  weatherTiles,
}: GoogleMapsLayersProps) {
  const { overlay, openWeatherApiKey, onRadarStatus } = weatherTiles
  const polygon = useFlightStore((s) => s.polygon)
  const draftPoints = useFlightStore((s) => s.draftPoints)
  const waypoints = useFlightStore((s) => s.waypoints)
  const poi = useFlightStore((s) => s.poi)

  const draftLine = useMemo(() => {
    if (draftPoints.length < 2) return null
    return {
      type: 'Feature' as const,
      properties: { ddSource: 'planner', ddType: 'draft' },
      geometry: {
        type: 'LineString' as const,
        coordinates: draftPoints.map(([lat, lng]) => [lng, lat]),
      },
    }
  }, [draftPoints])

  const routeLine = useMemo(() => {
    if (waypoints.length < 2) return null
    const sorted = [...waypoints].sort((a, b) => a.index - b.index)
    return {
      type: 'Feature' as const,
      properties: { ddSource: 'planner', ddType: 'route' },
      geometry: {
        type: 'LineString' as const,
        coordinates: sorted.map((w) => [w.lng, w.lat]),
      },
    }
  }, [waypoints])

  const wpFeatures = useMemo(() => {
    if (waypoints.length === 0) return null
    const sorted = [...waypoints].sort((a, b) => a.index - b.index)
    return sorted.map((w, i, arr) => ({
      type: 'Feature' as const,
      properties: {
        ddSource: 'planner',
        ddType: 'waypoint',
        role: i === 0 ? 'first' : i === arr.length - 1 ? 'last' : 'mid',
      },
      geometry: { type: 'Point' as const, coordinates: [w.lng, w.lat] },
    }))
  }, [waypoints])

  const poiPoint = useMemo(() => {
    if (!poi || mode === '3d') return null
    return {
      type: 'Feature' as const,
      properties: { ddSource: 'planner', ddType: 'poi' },
      geometry: { type: 'Point' as const, coordinates: [poi.lng, poi.lat] },
    }
  }, [poi, mode])

  const dataRef = useRef<google.maps.Data | null>(null)

  useEffect(() => {
    if (!map) return
    const data = new google.maps.Data({ map })
    data.setStyle((feature) => {
      const t = feature.getProperty('ddType') as string | undefined
      if (t === 'polygon') {
        return {
          fillColor: '#22c55e',
          fillOpacity: 0.2,
          strokeColor: '#4ade80',
          strokeWeight: 2,
        }
      }
      if (t === 'draft') {
        return { strokeColor: '#fbbf24', strokeWeight: 2, strokeOpacity: 0.95, fillOpacity: 0 }
      }
      if (t === 'route') {
        return { strokeColor: '#facc15', strokeWeight: 3, strokeOpacity: 0.88, fillOpacity: 0 }
      }
      if (t === 'waypoint') {
        const role = feature.getProperty('role') as string
        const fill =
          role === 'first' ? '#22c55e' : role === 'last' ? '#ef4444' : '#fafafa'
        return {
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 5,
            fillColor: fill,
            fillOpacity: 1,
            strokeColor: '#0a0a0a',
            strokeWeight: 2,
          },
        }
      }
      if (t === 'poi') {
        return {
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 9,
            fillColor: '#06b6d4',
            fillOpacity: 0.92,
            strokeColor: '#ecfeff',
            strokeWeight: 2,
          },
        }
      }
      return {}
    })
    dataRef.current = data
    return () => {
      data.setMap(null)
      dataRef.current = null
    }
  }, [map])

  useEffect(() => {
    const data = dataRef.current
    if (!data) return
    clearPlannerFeatures(data)

    if (polygon?.geometry?.type === 'Polygon') {
      data.addGeoJson({
        type: 'Feature',
        properties: { ddSource: 'planner', ddType: 'polygon' },
        geometry: polygon.geometry,
      })
    }

    if (draftLine) {
      data.addGeoJson({ type: 'FeatureCollection', features: [draftLine] })
    }
    if (nativeShowRoute && routeLine) {
      data.addGeoJson({ type: 'FeatureCollection', features: [routeLine] })
    }
    if (nativeShowWaypoints && wpFeatures?.length) {
      data.addGeoJson({ type: 'FeatureCollection', features: wpFeatures })
    }
    if (poiPoint) {
      data.addGeoJson({ type: 'FeatureCollection', features: [poiPoint] })
    }
  }, [
    polygon,
    draftLine,
    routeLine,
    wpFeatures,
    poiPoint,
    nativeShowRoute,
    nativeShowWaypoints,
  ])

  const { layerId, opacity } = overlay
  const clampedOpacity = clampOpacity(opacity)
  const [radarUrl, setRadarUrl] = useState<string | null>(null)
  const [radarFrameKey, setRadarFrameKey] = useState(0)
  const onRadarStatusRef = useRef(onRadarStatus)
  onRadarStatusRef.current = onRadarStatus

  useEffect(() => {
    if (layerId !== 'radar') {
      setRadarUrl(null)
      onRadarStatusRef.current?.('idle')
      return
    }
    let cancelled = false
    onRadarStatusRef.current?.('loading')
    void (async () => {
      try {
        const url = await fetchRainViewerRadarTileUrlTemplate()
        if (cancelled) return
        setRadarUrl(url)
        setRadarFrameKey((k) => k + 1)
        onRadarStatusRef.current?.('ready')
      } catch (e) {
        if (cancelled) return
        setRadarUrl(null)
        const msg = e instanceof Error ? e.message : 'Falha ao carregar radar'
        onRadarStatusRef.current?.('error', msg)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [layerId])

  useEffect(() => {
    if (!map) return
    const overlayMapTypes = map.overlayMapTypes
    while (overlayMapTypes.getLength() > 0) {
      overlayMapTypes.pop()
    }

    if (layerId === 'none') return

    if (layerId === 'radar') {
      if (!radarUrl) return
      const key = radarFrameKey
      const imageMap = new google.maps.ImageMapType({
        alt: 'Radar',
        name: `dronedata-radar-${String(key)}`,
        opacity: clampedOpacity,
        tileSize: new google.maps.Size(256, 256),
        getTileUrl: (coord, zoom) =>
          radarUrl
            .replace('{z}', String(zoom))
            .replace('{x}', String(coord.x))
            .replace('{y}', String(coord.y)),
      })
      overlayMapTypes.push(imageMap)
      return () => {
        const idx = overlayMapTypes.getArray().indexOf(imageMap)
        if (idx >= 0) overlayMapTypes.removeAt(idx)
      }
    }

    if (isOwmWeatherMapLayer(layerId) && openWeatherApiKey) {
      const slug = owmMapTileSlug(layerId)
      if (!slug) return
      const imageMap = new google.maps.ImageMapType({
        alt: 'Weather',
        name: `dronedata-owm-${layerId}`,
        opacity: clampedOpacity,
        tileSize: new google.maps.Size(256, 256),
        getTileUrl: (coord, zoom) =>
          `https://tile.openweathermap.org/map/${slug}/${String(zoom)}/${String(coord.x)}/${String(coord.y)}.png?appid=${encodeURIComponent(openWeatherApiKey)}`,
      })
      overlayMapTypes.push(imageMap)
      return () => {
        const idx = overlayMapTypes.getArray().indexOf(imageMap)
        if (idx >= 0) overlayMapTypes.removeAt(idx)
      }
    }

    return undefined
  }, [map, layerId, radarUrl, radarFrameKey, clampedOpacity, openWeatherApiKey])

  return null
}
