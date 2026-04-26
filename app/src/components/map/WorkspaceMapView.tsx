import type { WorkspacePanelId } from '@/constants/routes'
import type { WorkspaceMapWeatherTilesProps } from '@/components/map/useWorkspaceMapWeather'
import {
  GoogleMapsView,
  LeafletMapView,
  MapboxMapView,
  useMapEngine,
} from '@/features/map-engine'

type WorkspaceMapViewProps = {
  panel: WorkspacePanelId
  projectId: string | null
  weatherTiles: WorkspaceMapWeatherTilesProps
}

export function WorkspaceMapView({ panel, projectId, weatherTiles }: WorkspaceMapViewProps) {
  const { provider } = useMapEngine()

  switch (provider) {
    case 'mapbox':
      return <MapboxMapView panel={panel} projectId={projectId} weatherTiles={weatherTiles} />
    case 'google':
      return <GoogleMapsView panel={panel} projectId={projectId} weatherTiles={weatherTiles} />
    case 'leaflet':
    default:
      return <LeafletMapView panel={panel} projectId={projectId} weatherTiles={weatherTiles} />
  }
}
