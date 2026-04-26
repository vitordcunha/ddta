import { MapContainer } from 'react-leaflet'
import { MapBottomLeftControls } from '@/components/map/MapBottomLeftControls'
import { PlannerMapBaseLayer } from '@/components/map/PlannerMapBaseLayer'
import { FlightPlannerCalculationBridge } from '@/features/flight-planner/components/FlightPlannerCalculationBridge'
import { FlightPlannerMapContent } from '@/features/flight-planner/components/FlightPlannerMapContent'
import { ResultsMapInnerLayers } from '@/features/results/components/ResultsMapLayers'
import type { WorkspacePanelId } from '@/constants/routes'
import { MapBootstrapView } from '@/components/map/MapBootstrapView'
import { PlannerWeatherMapLayers } from '@/components/map/PlannerWeatherMapLayers'
import type { WorkspaceMapWeatherTilesProps } from '@/components/map/useWorkspaceMapWeather'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useMapBootstrapFocus } from '@/hooks/useMapBootstrapFocus'
import 'leaflet/dist/leaflet.css'

/** Fallback quando IP e GPS nao estao disponiveis (Brasilia). */
const DEFAULT_MAP_CENTER: [number, number] = [-15.793889, -47.882778]
const DEFAULT_MAP_ZOOM = 15

type WorkspaceMapViewProps = {
  panel: WorkspacePanelId
  projectId: string | null
  weatherTiles: WorkspaceMapWeatherTilesProps
}

export function WorkspaceMapView({ panel, projectId, weatherTiles }: WorkspaceMapViewProps) {
  const showPlan = panel === 'plan' && Boolean(projectId)
  const showResults = panel === 'results' && Boolean(projectId)
  const { position, error, phase, locate } = useGeolocation()
  const bootstrapFocus = useMapBootstrapFocus({ locate })
  const bottomLeftControls = (
    <MapBottomLeftControls
      position={position}
      error={error}
      phase={phase}
      locate={locate}
    />
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
        center={DEFAULT_MAP_CENTER}
        zoom={DEFAULT_MAP_ZOOM}
        className="h-full w-full"
        zoomControl={false}
        scrollWheelZoom
      >
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
            {showPlan ? (
              <>
                <FlightPlannerCalculationBridge />
                <FlightPlannerMapContent />
              </>
            ) : null}
            {bottomLeftControls}
          </>
        )}
      </MapContainer>
    </div>
  )
}
