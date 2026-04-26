import { useEffect } from 'react'
import { MapContainer, useMap } from 'react-leaflet'
import { MapBottomLeftControls } from '@/components/map/MapBottomLeftControls'
import { PlannerMapBaseLayer } from '@/components/map/PlannerMapBaseLayer'
import { FlightPlannerMapContent } from '@/features/flight-planner/components/FlightPlannerMapContent'
import { WindIndicatorOverlay } from '@/features/flight-planner/components/WindIndicatorOverlay'
import { ResultsMapInnerLayers } from '@/features/results/components/ResultsMapLayers'
import type { WorkspacePanelId } from '@/constants/routes'
import { MapBootstrapView } from '@/components/map/MapBootstrapView'
import { PlannerWeatherMapLayers } from '@/components/map/PlannerWeatherMapLayers'
import type { WorkspaceMapWeatherTilesProps } from '@/components/map/useWorkspaceMapWeather'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useMapBootstrapFocus } from '@/hooks/useMapBootstrapFocus'
import { useMapEngine } from '@/features/map-engine/useMapEngine'
import 'leaflet/dist/leaflet.css'

type LeafletMapViewProps = {
  panel: WorkspacePanelId
  projectId: string | null
  weatherTiles: WorkspaceMapWeatherTilesProps
}

function LeafletViewSync() {
  const map = useMap()
  const { center, zoom, setCenterZoom } = useMapEngine()

  useEffect(() => {
    const onMoveEnd = () => {
      const c = map.getCenter()
      setCenterZoom([c.lat, c.lng], map.getZoom())
    }
    map.on('moveend', onMoveEnd)
    return () => {
      map.off('moveend', onMoveEnd)
    }
  }, [map, setCenterZoom])

  useEffect(() => {
    const mc = map.getCenter()
    const z = map.getZoom()
    const sameLat = Math.abs(mc.lat - center[0]) < 1e-7
    const sameLng = Math.abs(mc.lng - center[1]) < 1e-7
    if (sameLat && sameLng && z === zoom) return
    map.setView(center, zoom, { animate: false })
  }, [center, zoom, map])

  return null
}

export function LeafletMapView({ panel, projectId, weatherTiles }: LeafletMapViewProps) {
  const showPlan = panel === 'plan' && Boolean(projectId)
  const showResults = panel === 'results' && Boolean(projectId)
  const { position, error, phase, locate } = useGeolocation()
  const bootstrapFocus = useMapBootstrapFocus({ locate })
  const { center, zoom, setCenterZoom } = useMapEngine()

  useEffect(() => {
    if (!bootstrapFocus) return
    setCenterZoom(bootstrapFocus.center, bootstrapFocus.zoom)
  }, [bootstrapFocus, setCenterZoom])

  const bottomLeftControls = (
    <MapBottomLeftControls position={position} error={error} phase={phase} locate={locate} />
  )

  const weatherTileLayers = (
    <PlannerWeatherMapLayers
      overlay={weatherTiles.overlay}
      openWeatherApiKey={weatherTiles.openWeatherApiKey}
      onRadarStatus={weatherTiles.onRadarStatus}
    />
  )

  return (
    <div className="absolute inset-0 z-0 min-h-0 w-full">
      <MapContainer
        center={center}
        zoom={zoom}
        className="h-full w-full"
        zoomControl={false}
        scrollWheelZoom
      >
        <LeafletViewSync />
        <MapBootstrapView focus={bootstrapFocus} />
        {showResults ? (
          <>
            <ResultsMapInnerLayers projectId={projectId} />
            {weatherTileLayers}
            {bottomLeftControls}
          </>
        ) : (
          <>
            <PlannerMapBaseLayer />
            {weatherTileLayers}
            {showPlan ? <FlightPlannerMapContent /> : null}
            {showPlan ? <WindIndicatorOverlay /> : null}
            {bottomLeftControls}
          </>
        )}
      </MapContainer>
    </div>
  )
}
