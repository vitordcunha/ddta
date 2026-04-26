import 'mapbox-gl/dist/mapbox-gl.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import Map, { type MapRef } from 'react-map-gl/mapbox'
import type { Map as MapboxMap } from 'mapbox-gl'
import { Link } from 'react-router-dom'
import type { WorkspacePanelId } from '@/constants/routes'
import { toWorkspace } from '@/constants/routes'
import type { WorkspaceMapWeatherTilesProps } from '@/components/map/useWorkspaceMapWeather'
import { useMapEngine } from '@/features/map-engine/useMapEngine'
import { useFlightStore } from '@/features/flight-planner/stores/useFlightStore'
import { useResultsViewStore } from '@/features/results/stores/useResultsViewStore'
import { useMapBootstrapFocus } from '@/hooks/useMapBootstrapFocus'
import { useGeolocation } from '@/hooks/useGeolocation'
import { MapboxBottomLeft } from '@/features/map-engine/providers/mapbox/MapboxBottomLeft'
import { MapboxControls } from '@/features/map-engine/providers/mapbox/MapboxControls'
import { MapboxLayers } from '@/features/map-engine/providers/mapbox/MapboxLayers'
import { MapboxPlanOverlays } from '@/features/map-engine/providers/mapbox/MapboxPlanOverlays'
import { MapboxDeckRouteOverlay } from '@/features/map-engine/providers/mapbox/MapboxDeckRouteOverlay'
import { MapboxWeatherOverlays } from '@/features/map-engine/providers/mapbox/MapboxWeatherOverlays'
import { useMapboxSync } from '@/features/map-engine/providers/mapbox/useMapboxSync'
import type { MapLayerMouseEvent } from 'mapbox-gl'
import { newPointOfInterest } from '@/features/flight-planner/types/poi'

const MAP_STYLE = 'mapbox://styles/mapbox/satellite-streets-v12'

type MapboxMapViewProps = {
  panel: WorkspacePanelId
  projectId: string | null
  weatherTiles: WorkspaceMapWeatherTilesProps
}

export function MapboxMapView({ panel, projectId, weatherTiles }: MapboxMapViewProps) {
  const showPlan = panel === 'plan' && Boolean(projectId)
  const showResults = panel === 'results' && Boolean(projectId)
  const showPlanOrResults = showPlan || showResults
  const { locate } = useGeolocation()
  const { mapboxToken, mode, center, zoom, setCenterZoom } = useMapEngine()
  const deckVis = useFlightStore((s) =>
    panel === 'results' ? s.deckMapVisibility.results : s.deckMapVisibility.plan,
  )
  const showRealFlightPath = useResultsViewStore((s) => s.showRealFlightPath)
  const selectedWaypointId = useFlightStore((s) => s.selectedWaypointId)
  const poiPlacementActive = useFlightStore((s) => s.poiPlacementActive)
  const bootstrapFocus = useMapBootstrapFocus({ locate })
  const mapRef = useRef<MapRef>(null)
  const [mapInstance, setMapInstance] = useState<MapboxMap | null>(null)

  useEffect(() => {
    if (!bootstrapFocus) return
    setCenterZoom(bootstrapFocus.center, bootstrapFocus.zoom)
  }, [bootstrapFocus, setCenterZoom])

  const { onMoveEnd } = useMapboxSync(mapRef)

  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map) return
    map.easeTo({
      pitch: mode === '3d' ? 45 : 0,
      bearing: 0,
      duration: 400,
      essential: true,
    })
  }, [mode])

  const onLoad = useCallback((e: { target: MapboxMap }) => {
    setMapInstance(e.target)
  }, [])

  useEffect(() => {
    if (!mapInstance || !showPlan || !poiPlacementActive) return
    const canvas = mapInstance.getCanvas()
    const prev = canvas.style.cursor
    canvas.style.cursor = 'crosshair'
    const onClick = (e: MapLayerMouseEvent) => {
      if (!useFlightStore.getState().poiPlacementActive) return
      const st = useFlightStore.getState()
      if (st.poi) {
        st.setPoi({ ...st.poi, lat: e.lngLat.lat, lng: e.lngLat.lng })
      } else {
        st.setPoi(
          newPointOfInterest(e.lngLat.lat, e.lngLat.lng, st.waypoints, st.params.altitudeM),
        )
      }
    }
    mapInstance.on('click', onClick)
    return () => {
      mapInstance.off('click', onClick)
      canvas.style.cursor = prev
    }
  }, [mapInstance, showPlan, poiPlacementActive])

  const hasKey = mapboxToken.length > 0

  if (!hasKey) {
    return (
      <div className="absolute inset-0 z-0 flex flex-col items-center justify-center gap-3 bg-[#0f0f0f] px-6 text-center">
        <p className="text-sm font-medium text-neutral-200">Mapbox</p>
        <p className="max-w-sm text-xs text-neutral-500">
          Defina a chave Mapbox em Configuracoes para habilitar este provedor.
        </p>
        <Link
          className="text-xs font-medium text-primary-400 underline-offset-2 hover:underline"
          to={toWorkspace('/', { panel: 'settings' })}
        >
          Abrir configuracoes
        </Link>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 z-0 min-h-0 w-full">
      <Map
        ref={mapRef}
        mapboxAccessToken={mapboxToken}
        mapStyle={MAP_STYLE}
        initialViewState={{
          latitude: center[0],
          longitude: center[1],
          zoom,
          pitch: mode === '3d' ? 45 : 0,
          bearing: 0,
        }}
        onMoveEnd={onMoveEnd}
        onLoad={onLoad}
        style={{ width: '100%', height: '100%' }}
        attributionControl
      >
        <MapboxLayers map={mapInstance} mode={mode} />
        <MapboxWeatherOverlays
          overlay={weatherTiles.overlay}
          openWeatherApiKey={weatherTiles.openWeatherApiKey}
          onRadarStatus={weatherTiles.onRadarStatus}
        />
        {showPlanOrResults ? (
          <MapboxPlanOverlays
            nativeShowRoute={mode !== '3d' && deckVis.showRoute}
            nativeShowWaypoints={mode !== '3d' && deckVis.showWaypoints}
          />
        ) : null}
        <MapboxDeckRouteOverlay
          map={mapInstance}
          panel={panel}
          projectId={projectId}
          enabled={
            showPlanOrResults &&
            (mode === '3d' ||
              selectedWaypointId != null ||
              (showResults && showRealFlightPath))
          }
        />
        <MapboxControls />
        <MapboxBottomLeft showResults={showResults} />
        {/* WindIndicatorOverlay moved to WorkspacePage to respect --right-panel-width */}
      </Map>
    </div>
  )
}
