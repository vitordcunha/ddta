import type { PlannerBaseLayerId } from '@/features/flight-planner/constants/mapBaseLayers'
import type { MapMode } from '@/features/map-engine/types'

/**
 * Roadmap escuro (JSON styling) — equivalente aproximado ao preset Leaflet "Escuro (Carto)".
 * So aplica quando `mapTypeId` e roadmap.
 */
export const GOOGLE_WORKSPACE_ROADMAP_DARK_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#d59563' }],
  },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#263c3f' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#38414e' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#212a37' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#746855' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1f2835' }],
  },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#17263c' }],
  },
]

/** Basemap classico Google: combina preset do planejador com 2D/3D. */
export function googleWorkspaceClassicMapTypeId(
  mode: MapMode,
  baseLayer: PlannerBaseLayerId,
): string {
  if (baseLayer === 'satellite') {
    return mode === '3d' ? 'hybrid' : 'satellite'
  }
  if (baseLayer === 'topo') return 'terrain'
  if (baseLayer === 'streets' || baseLayer === 'dark') return 'roadmap'
  return 'satellite'
}

export function googleWorkspaceClassicMapStyles(
  baseLayer: PlannerBaseLayerId,
): google.maps.MapTypeStyle[] | undefined {
  return baseLayer === 'dark' ? GOOGLE_WORKSPACE_ROADMAP_DARK_STYLES : undefined
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
  plannerBaseLayer: PlannerBaseLayerId
}): google.maps.MapOptions {
  const { mapId, mode, plannerBaseLayer } = opts
  const cp = controlPosition()
  return {
    mapId,
    mapTypeId: googleWorkspaceClassicMapTypeId(mode, plannerBaseLayer),
    styles: googleWorkspaceClassicMapStyles(plannerBaseLayer),
    disableDefaultUI: false,
    zoomControl: false,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true,
    fullscreenControlOptions: cp ? { position: cp.LEFT_BOTTOM } : undefined,
    scaleControl: true,
    // @types/google.maps só declara `style` em ScaleControlOptions; a API JS ainda aceita `position`.
    scaleControlOptions: cp
      ? ({ position: cp.BOTTOM_LEFT } as google.maps.ScaleControlOptions)
      : undefined,
    rotateControl: mode === '3d',
    rotateControlOptions:
      mode === '3d' && cp ? { position: cp.LEFT_CENTER } : undefined,
    tilt: googleWorkspaceClassicTilt(mode),
    gestureHandling: 'greedy',
  }
}
