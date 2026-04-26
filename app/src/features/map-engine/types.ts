export type MapProvider = 'leaflet' | 'mapbox' | 'google'
export type MapMode = '2d' | '3d'

export type MapEngineState = {
  provider: MapProvider
  mode: MapMode
  /** [lat, lng] */
  center: [number, number]
  zoom: number
}

/**
 * Contrato comum aos motores de mapa (implementações futuras nos provedores).
 * Fase 1 define o estado global; métodos podem ser estendidos nas fases 4+.
 */
export type IMapEngine = MapEngineState & {
  setCenterZoom: (center: [number, number], zoom: number) => void
  setProvider: (provider: MapProvider) => void
  setMode: (mode: MapMode) => void
}
