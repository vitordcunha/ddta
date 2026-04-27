import { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DeckGLOverlay } from '@/features/map-engine/providers/mapbox/DeckGLOverlay'
import { useDroneRouteLayers } from '@/features/map-engine/layers/useDroneRouteLayers'
import {
  createRealFlightPathLayer,
  lineStringCoordinates3d,
} from '@/features/map-engine/layers/RealFlightPathLayer'
import { useDroneModelsQuery } from '@/features/flight-planner/hooks/useDroneModelsQuery'
import { useFlightStore } from '@/features/flight-planner/stores/useFlightStore'
import {
  profileToCameraParams,
  resolveFlightDroneProfile,
} from '@/features/flight-planner/utils/flightDroneProfile'
import { useMapEngine } from '@/features/map-engine/useMapEngine'
import { useResultsViewStore } from '@/features/results/stores/useResultsViewStore'
import { projectsService } from '@/services/projectsService'
import type { WorkspacePanelId } from '@/constants/routes'
import type { Map as MapboxMap } from 'mapbox-gl'

type MapboxDeckRouteOverlayProps = {
  map: MapboxMap | null
  panel: WorkspacePanelId
  projectId: string | null
  enabled: boolean
}

export function MapboxDeckRouteOverlay({
  map,
  panel,
  projectId,
  enabled,
}: MapboxDeckRouteOverlayProps) {
  const { mode, deviceTier } = useMapEngine()
  const scope = panel === 'results' ? 'results' : 'plan'
  const { showRoute, showWaypoints } = useFlightStore((s) => s.deckMapVisibility[scope])
  const waypoints = useFlightStore((s) => s.waypoints)
  const params = useFlightStore((s) => s.params)
  const poi = useFlightStore((s) => s.poi)
  const selectedWaypointId = useFlightStore((s) => s.selectedWaypointId)
  const setSelectedWaypoint = useFlightStore((s) => s.setSelectedWaypoint)
  const frustum3dInDeck = useFlightStore((s) => s.frustum3dInDeck)
  const frustumWaypoint = useMemo(() => {
    if (!selectedWaypointId) return null
    return waypoints.find((w) => w.id === selectedWaypointId) ?? null
  }, [waypoints, selectedWaypointId])
  const deckPlanGeometry = mode === '3d'
  const { data: droneCatalog } = useDroneModelsQuery()
  const droneCamera = useMemo(
    () => profileToCameraParams(resolveFlightDroneProfile(params, droneCatalog)),
    [params.droneModel, params.droneModelId, droneCatalog],
  )
  const baseLayers = useDroneRouteLayers({
    waypoints,
    showRoute,
    showWaypoints,
    poi,
    frustumWaypoint,
    deckPlanGeometry,
    selectedWaypointId,
    deviceTier,
    showFrustum3d: frustum3dInDeck,
    droneCamera,
  })

  const showRealFlightPath = useResultsViewStore((s) => s.showRealFlightPath)
  const { data: flightPathGeo } = useQuery({
    queryKey: ['project-flight-path', projectId],
    queryFn: () => projectsService.getFlightPathGeoJson(projectId!),
    enabled: Boolean(projectId && panel === 'results' && showRealFlightPath),
    retry: false,
  })

  const realFlightLayer = useMemo(() => {
    if (panel !== 'results' || !flightPathGeo) return null
    const coords = lineStringCoordinates3d(flightPathGeo)
    return createRealFlightPathLayer(coords)
  }, [flightPathGeo, panel])

  const layers = useMemo(() => {
    const out = [...baseLayers]
    if (realFlightLayer) out.push(realFlightLayer)
    return out
  }, [baseLayers, realFlightLayer])

  const onWaypointPickMiss = useCallback(() => {
    const st = useFlightStore.getState()
    if (st.poiPlacementActive) return
    if (st.plannerInteractionMode !== 'navigate') return
    if (st.selectedWaypointId) st.setSelectedWaypoint(null)
  }, [])

  if (!enabled || !map || layers.length === 0) return null

  return (
    <DeckGLOverlay
      map={map}
      layers={layers}
      onWaypointClick={setSelectedWaypoint}
      onWaypointPickMiss={onWaypointPickMiss}
    />
  )
}
