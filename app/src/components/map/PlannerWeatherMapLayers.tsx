import { useEffect, useRef, useState } from 'react'
import { TileLayer } from 'react-leaflet'
import { fetchRainViewerRadarTileUrlTemplate } from '@/components/map/weather/fetchRainViewerRadarTemplate'
import {
  isOwmWeatherMapLayer,
  owmMapTileSlug,
  type WeatherMapOverlayPreferences,
} from '@/components/map/weather/mapWeatherTypes'

export type RadarOverlayStatus = 'idle' | 'loading' | 'ready' | 'error'

type PlannerWeatherMapLayersProps = {
  overlay: WeatherMapOverlayPreferences
  openWeatherApiKey: string
  onRadarStatus?: (status: RadarOverlayStatus, message?: string) => void
}

function clampOpacity(n: number): number {
  if (Number.isNaN(n)) return 0.62
  return Math.min(0.95, Math.max(0.22, n))
}

export function PlannerWeatherMapLayers({
  overlay,
  openWeatherApiKey,
  onRadarStatus,
}: PlannerWeatherMapLayersProps) {
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
      // Reset de tiles ao mudar de camada; padrao fetch + cleanup.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- estado local sincronizado com layerId
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
        if (!cancelled) {
          onRadarStatusRef.current?.('ready')
        }
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
    if (!radarUrl) {
      return null
    }
    return (
      <TileLayer
        key={`radar-${String(radarFrameKey)}`}
        url={radarUrl}
        opacity={clampedOpacity}
        zIndex={280}
        attribution='Radar &copy; <a href="https://www.rainviewer.com/">RainViewer</a>'
      />
    )
  }

  if (isOwmWeatherMapLayer(layerId)) {
    if (!openWeatherApiKey) {
      return null
    }
    const owmLayer = owmMapTileSlug(layerId)
    if (!owmLayer) {
      return null
    }
    const url = `https://tile.openweathermap.org/map/${owmLayer}/{z}/{x}/{y}.png?appid=${encodeURIComponent(openWeatherApiKey)}`
    return (
      <TileLayer
        key={layerId}
        url={url}
        opacity={clampedOpacity}
        zIndex={280}
        maxZoom={19}
        attribution='Weather &copy; <a href="https://openweathermap.org/">OpenWeatherMap</a>'
      />
    )
  }

  return null
}
