import type { MapMode } from '@/features/map-engine/types'

/** Basemap classico: satelite em 2D; hibrido em 3D (quando nao usamos o mapa imersivo). */
export function googleWorkspaceClassicMapTypeId(mode: MapMode): string {
  return mode === '3d' ? 'hybrid' : 'satellite'
}

export function googleWorkspaceClassicTilt(mode: MapMode): number {
  return mode === '3d' ? 45 : 0
}

export function buildGoogleWorkspaceClassicMapOptions(opts: {
  mapId?: string
  mode: MapMode
}): google.maps.MapOptions {
  const { mapId, mode } = opts
  return {
    mapId,
    mapTypeId: googleWorkspaceClassicMapTypeId(mode),
    disableDefaultUI: false,
    zoomControl: false,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true,
    scaleControl: true,
    rotateControl: mode === '3d',
    tilt: googleWorkspaceClassicTilt(mode),
    gestureHandling: 'greedy',
  }
}
