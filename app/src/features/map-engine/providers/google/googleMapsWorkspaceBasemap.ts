import type { MapMode } from '@/features/map-engine/types'

/** Basemap classico: satelite em 2D; hibrido em 3D (quando nao usamos o mapa imersivo). */
export function googleWorkspaceClassicMapTypeId(mode: MapMode): string {
  return mode === '3d' ? 'hybrid' : 'satellite'
}

export function googleWorkspaceClassicTilt(mode: MapMode): number {
  return mode === '3d' ? 45 : 0
}

function controlPosition() {
  if (typeof globalThis === 'undefined') return undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = (globalThis as any).google as typeof google | undefined
  return g?.maps?.ControlPosition
}

/**
 * Tela de trabalho: canto inferior direito fica reservado ao cluster da plataforma
 * (3D, vento) — puxa fullscreen, escala e bússola/tilt padrão para a esquerda/abaixo.
 */
export function buildGoogleWorkspaceClassicMapOptions(opts: {
  mapId?: string
  mode: MapMode
}): google.maps.MapOptions {
  const { mapId, mode } = opts
  const cp = controlPosition()
  return {
    mapId,
    mapTypeId: googleWorkspaceClassicMapTypeId(mode),
    disableDefaultUI: false,
    zoomControl: false,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true,
    fullscreenControlOptions: cp ? { position: cp.LEFT_BOTTOM } : undefined,
    scaleControl: true,
    scaleControlOptions: cp ? { position: cp.BOTTOM_LEFT } : undefined,
    rotateControl: mode === '3d',
    rotateControlOptions:
      mode === '3d' && cp ? { position: cp.LEFT_CENTER } : undefined,
    tilt: googleWorkspaceClassicTilt(mode),
    gestureHandling: 'greedy',
  }
}
