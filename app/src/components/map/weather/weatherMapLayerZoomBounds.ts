import type { WeatherMapLayerId } from "@/components/map/weather/mapWeatherTypes";

/**
 * OpenWeatherMap tiles 1.0 (tile.openweathermap.org/map/...) — a API
 * restringe o nível de detalhe; além do máximo, os tiles deixam de
 * refletir dados úteis (ou são upscaled).
 * @see https://openweathermap.org/api/weathermaps
 */
const OWM_MAP_TILES_MAX_ZOOM = 9;

/**
 * RainViewer: documentação indica no máximo zoom 7 em z/x/y.
 * @see https://www.rainviewer.com/api/weather-maps-api.html
 */
const RADAR_RAINVIEWER_MAX_ZOOM = 7;

/** Zoom mínimo para pedir tile (0 = visão global; APIs não restringem acima de 0). */
const DEFAULT_MIN_ZOOM = 0;

export const WEATHER_MAP_TILE_ZOOM: Record<
  WeatherMapLayerId,
  { min: number; max: number } | null
> = {
  none: null,
  radar: { min: DEFAULT_MIN_ZOOM, max: RADAR_RAINVIEWER_MAX_ZOOM },
  owm_wind: { min: DEFAULT_MIN_ZOOM, max: OWM_MAP_TILES_MAX_ZOOM },
  owm_clouds: { min: DEFAULT_MIN_ZOOM, max: OWM_MAP_TILES_MAX_ZOOM },
  owm_precipitation: { min: DEFAULT_MIN_ZOOM, max: OWM_MAP_TILES_MAX_ZOOM },
  owm_temp: { min: DEFAULT_MIN_ZOOM, max: OWM_MAP_TILES_MAX_ZOOM },
};

/**
 * Ajusta o zoom do mapa à faixa suportada pelos tiles da camada; devolve
 * o zoom alvo ou o próprio se já estiver dentro da faixa. Para `none`,
 * devolve o zoom sem alterar.
 */
export function clampMapZoomToWeatherMapLayer(
  layerId: WeatherMapLayerId,
  zoom: number,
): number {
  const b = WEATHER_MAP_TILE_ZOOM[layerId];
  if (!b) return zoom;
  return Math.min(b.max, Math.max(b.min, zoom));
}
