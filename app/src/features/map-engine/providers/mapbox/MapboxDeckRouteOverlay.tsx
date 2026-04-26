import { DeckGLOverlay } from '@/features/map-engine/providers/mapbox/DeckGLOverlay'
import { useDroneRouteLayers } from '@/features/map-engine/layers/useDroneRouteLayers'
import { useFlightStore } from '@/features/flight-planner/stores/useFlightStore'
import type { WorkspacePanelId } from '@/constants/routes'
import type { Map as MapboxMap } from 'mapbox-gl'

type MapboxDeckRouteOverlayProps = {
  map: MapboxMap | null
  panel: WorkspacePanelId
  enabled: boolean
}

export function MapboxDeckRouteOverlay({
  map,
  panel,
  enabled,
}: MapboxDeckRouteOverlayProps) {
  const scope = panel === 'results' ? 'results' : 'plan'
  const { showRoute, showWaypoints } = useFlightStore((s) => s.deckMapVisibility[scope])
  const waypoints = useFlightStore((s) => s.waypoints)
  const poi = useFlightStore((s) => s.poi)
  const setSelectedWaypoint = useFlightStore((s) => s.setSelectedWaypoint)
  const layers = useDroneRouteLayers({
    waypoints,
    showRoute,
    showWaypoints,
    poi,
  })

  if (!enabled || !map || layers.length === 0) return null

  return (
    <DeckGLOverlay
      map={map}
      layers={layers}
      onWaypointClick={setSelectedWaypoint}
    />
  )
}
