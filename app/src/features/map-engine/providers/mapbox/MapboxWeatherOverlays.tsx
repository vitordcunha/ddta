import { useEffect, useRef, useState } from 'react'
import { Layer, Source } from 'react-map-gl/mapbox'
import { fetchRainViewerRadarTileUrlTemplate } from '@/components/map/weather/fetchRainViewerRadarTemplate'
import {
  isOwmWeatherMapLayer,
  owmMapTileSlug,
  type WeatherMapOverlayPreferences,
} from '@/components/map/weather/mapWeatherTypes'
import { WEATHER_MAP_TILE_ZOOM } from '@/components/map/weather/weatherMapLayerZoomBounds'

export type RadarOverlayStatus = 'idle' | 'loading' | 'ready' | 'error'

type Props = {
  overlay: WeatherMapOverlayPreferences
  openWeatherApiKey: string
  onRadarStatus?: (status: RadarOverlayStatus, message?: string) => void
}

function clampOpacity(n: number): number {
  if (Number.isNaN(n)) return 0.62
  return Math.min(0.95, Math.max(0.22, n))
}

/** Sobreposição meteorológica em tiles raster (RainViewer / OpenWeather), espelhando o Leaflet. */
export function MapboxWeatherOverlays({ overlay, openWeatherApiKey, onRadarStatus }: Props) {
  const { layerId, opacity } = overlay
  const clampedOpacity = clampOpacity(opacity)
  const [radarUrl, setRadarUrl] = useState<string | null>(null)
  const [radarFrameKey, setRadarFrameKey] = useState(0)
  const onRadarStatusRef = useRef(onRadarStatus)

  useEffect(() => {
    onRadarStatusRef.current = onRadarStatus
  }, [onRadarStatus])

  useEffect(() => {
    if (layerId !== 'radar') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- alinhado a PlannerWeatherMapLayers (reset ao mudar overlay)
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

  if (layerId === 'none') {
    return null
  }

  if (layerId === 'radar') {
    if (!radarUrl) return null
    return (
      <Source
        key={`radar-${String(radarFrameKey)}`}
        id="dronedata-weather-radar"
        type="raster"
        tiles={[radarUrl]}
        tileSize={256}
        attribution="Radar &copy; <a href='https://www.rainviewer.com/'>RainViewer</a>"
      >
        <Layer
          id="dronedata-weather-radar-layer"
          type="raster"
          maxzoom={WEATHER_MAP_TILE_ZOOM.radar!.max}
          paint={{ 'raster-opacity': clampedOpacity }}
        />
      </Source>
    )
  }

  if (isOwmWeatherMapLayer(layerId)) {
    if (!openWeatherApiKey) return null
    const owmLayer = owmMapTileSlug(layerId)
    if (!owmLayer) return null
    const owmZ = WEATHER_MAP_TILE_ZOOM[layerId]!.max
    const url = `https://tile.openweathermap.org/map/${owmLayer}/{z}/{x}/{y}.png?appid=${encodeURIComponent(openWeatherApiKey)}`
    return (
      <Source
        key={layerId}
        id={`dronedata-weather-owm-${layerId}`}
        type="raster"
        tiles={[url]}
        tileSize={256}
        attribution="Weather &copy; <a href='https://openweathermap.org/'>OpenWeatherMap</a>"
      >
        <Layer
          id={`dronedata-weather-owm-layer-${layerId}`}
          type="raster"
          paint={{ 'raster-opacity': clampedOpacity }}
          maxzoom={owmZ}
        />
      </Source>
    )
  }

  return null
}
