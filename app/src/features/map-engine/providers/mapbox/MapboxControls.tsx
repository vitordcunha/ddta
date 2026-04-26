import { NavigationControl, ScaleControl } from 'react-map-gl/mapbox'

/** Controles nativos Mapbox (navegação inclui zoom e orientação). */
export function MapboxControls() {
  return (
    <>
      <NavigationControl showZoom showCompass position="top-right" />
      <ScaleControl unit="metric" position="bottom-right" />
    </>
  )
}
