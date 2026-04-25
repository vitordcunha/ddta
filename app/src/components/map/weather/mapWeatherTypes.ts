export const WEATHER_MAP_LAYER_IDS = [
  'none',
  'radar',
  'owm_wind',
  'owm_clouds',
  'owm_precipitation',
  'owm_temp',
] as const

export type WeatherMapLayerId = (typeof WEATHER_MAP_LAYER_IDS)[number]

export type WeatherMapOverlayPreferences = {
  layerId: WeatherMapLayerId
  /** Opacidade da camada (0.25 a 0.95). */
  opacity: number
}

export const WEATHER_MAP_OVERLAY_STORAGE_KEY = 'app:map-weather-overlay'

export const DEFAULT_WEATHER_MAP_OVERLAY: WeatherMapOverlayPreferences = {
  layerId: 'none',
  opacity: 0.62,
}

export function isOwmWeatherMapLayer(id: WeatherMapLayerId): boolean {
  return id.startsWith('owm_')
}

/** Nome da camada na API de tiles da OpenWeatherMap. */
export function owmMapTileSlug(id: WeatherMapLayerId): string | null {
  switch (id) {
    case 'owm_wind':
      return 'wind_new'
    case 'owm_clouds':
      return 'clouds_new'
    case 'owm_precipitation':
      return 'precipitation_new'
    case 'owm_temp':
      return 'temp_new'
    default:
      return null
  }
}
