import { useCallback, useState } from 'react'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import {
  DEFAULT_USER_PREFERENCES,
  USER_PREFERENCES_STORAGE_KEY,
  type UserPreferences,
} from '@/constants/userPreferences'
import {
  DEFAULT_WEATHER_MAP_OVERLAY,
  WEATHER_MAP_OVERLAY_STORAGE_KEY,
  type WeatherMapOverlayPreferences,
} from '@/components/map/weather/mapWeatherTypes'
import type { RadarOverlayStatus } from '@/components/map/PlannerWeatherMapLayers'

/** Props para `PlannerWeatherMapLayers` dentro do `MapContainer`. */
export type WorkspaceMapWeatherTilesProps = {
  overlay: WeatherMapOverlayPreferences
  openWeatherApiKey: string
  onRadarStatus: (status: RadarOverlayStatus, message?: string) => void
}

/**
 * Estado partilhado entre tiles no mapa e controlos na UI do workspace (fora do z-0 do mapa).
 */
export function useWorkspaceMapWeather() {
  const [userPrefs] = useLocalStorage<UserPreferences>(
    USER_PREFERENCES_STORAGE_KEY,
    DEFAULT_USER_PREFERENCES,
  )
  const [overlay, setOverlay] = useLocalStorage<WeatherMapOverlayPreferences>(
    WEATHER_MAP_OVERLAY_STORAGE_KEY,
    DEFAULT_WEATHER_MAP_OVERLAY,
  )
  const [radarStatus, setRadarStatus] = useState<RadarOverlayStatus>('idle')
  const [radarMessage, setRadarMessage] = useState<string | undefined>()

  const owmKey = userPrefs.openWeatherApiKey.trim()

  const onRadarStatus = useCallback((status: RadarOverlayStatus, message?: string) => {
    setRadarStatus(status)
    setRadarMessage(message)
  }, [])

  return {
    overlay,
    setOverlay,
    openWeatherApiKey: owmKey,
    radarStatus,
    radarMessage,
    onRadarStatus,
  }
}
