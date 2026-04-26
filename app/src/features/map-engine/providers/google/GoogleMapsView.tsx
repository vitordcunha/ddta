import { useCallback, useEffect, useState } from 'react'
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api'
import { Link } from 'react-router-dom'
import type { WorkspacePanelId } from '@/constants/routes'
import { toWorkspace } from '@/constants/routes'
import type { WorkspaceMapWeatherTilesProps } from '@/components/map/useWorkspaceMapWeather'
import { useMapEngine } from '@/features/map-engine/useMapEngine'
import { useFlightStore } from '@/features/flight-planner/stores/useFlightStore'
import { useResultsViewStore } from '@/features/results/stores/useResultsViewStore'
import { useMapBootstrapFocus } from '@/hooks/useMapBootstrapFocus'
import { useGeolocation } from '@/hooks/useGeolocation'
import { newPointOfInterest } from '@/features/flight-planner/types/poi'
import { GoogleMapsLayers } from '@/features/map-engine/providers/google/GoogleMapsLayers'
import { GoogleMapsDeckRouteOverlay } from '@/features/map-engine/providers/google/GoogleMapsDeckRouteOverlay'
import { GoogleMapsBottomLeft } from '@/features/map-engine/providers/google/GoogleMapsBottomLeft'
import { useGoogleMapsSync } from '@/features/map-engine/providers/google/useGoogleMapsSync'

type GoogleMapsViewProps = {
  panel: WorkspacePanelId
  projectId: string | null
  weatherTiles: WorkspaceMapWeatherTilesProps
}

function readGoogleMapsMapId(): string | undefined {
  const raw = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string | undefined
  const t = raw?.trim()
  return t && t.length > 0 ? t : undefined
}

function GoogleMapsViewInner({
  panel,
  projectId,
  weatherTiles,
  googleMapsApiKey,
}: GoogleMapsViewProps & { googleMapsApiKey: string }) {
  const showPlan = panel === 'plan' && Boolean(projectId)
  const showResults = panel === 'results' && Boolean(projectId)
  const showPlanOrResults = showPlan || showResults
  const { position, locate } = useGeolocation()
  const bootstrapFocus = useMapBootstrapFocus({ locate })
  const { mode, center, zoom, setCenterZoom } = useMapEngine()
  const deckVis = useFlightStore((s) =>
    panel === 'results' ? s.deckMapVisibility.results : s.deckMapVisibility.plan,
  )
  const showRealFlightPath = useResultsViewStore((s) => s.showRealFlightPath)
  const selectedWaypointId = useFlightStore((s) => s.selectedWaypointId)
  const poiPlacementActive = useFlightStore((s) => s.poiPlacementActive)

  const mapId = readGoogleMapsMapId()
  const mapIdDefined = Boolean(mapId)

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'dronedata-google-maps-loader',
    googleMapsApiKey,
    version: 'weekly',
  })

  const [map, setMap] = useState<google.maps.Map | null>(null)

  useGoogleMapsSync(map)

  useEffect(() => {
    if (!bootstrapFocus) return
    setCenterZoom(bootstrapFocus.center, bootstrapFocus.zoom)
  }, [bootstrapFocus, setCenterZoom])

  useEffect(() => {
    if (!map) return
    map.setTilt(mode === '3d' ? 45 : 0)
    map.setHeading(0)
  }, [map, mode])

  useEffect(() => {
    if (!map || !showPlan || !poiPlacementActive) return
    map.setOptions({ draggableCursor: 'crosshair' })
    const listener = map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (!useFlightStore.getState().poiPlacementActive) return
      if (!e.latLng) return
      const lat = e.latLng.lat()
      const lng = e.latLng.lng()
      const st = useFlightStore.getState()
      if (st.poi) {
        st.setPoi({ ...st.poi, lat, lng })
      } else {
        st.setPoi(newPointOfInterest(lat, lng, st.waypoints, st.params.altitudeM))
      }
    })
    return () => {
      listener.remove()
      map.setOptions({ draggableCursor: undefined })
    }
  }, [map, showPlan, poiPlacementActive])

  const onMapLoad = useCallback((m: google.maps.Map) => {
    setMap(m)
  }, [])

  const onMapUnmount = useCallback(() => {
    setMap(null)
  }, [])

  if (loadError) {
    return (
      <div className="absolute inset-0 z-0 flex flex-col items-center justify-center gap-3 bg-[#0f0f0f] px-6 text-center">
        <p className="text-sm font-medium text-neutral-200">Google Maps</p>
        <p className="max-w-sm text-xs text-red-300/90">
          Falha ao carregar a API do Google Maps. Verifique a chave e as restricoes no Google Cloud.
        </p>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="absolute inset-0 z-0 flex items-center justify-center bg-[#0f0f0f]">
        <p className="text-xs text-neutral-500">Carregando Google Maps…</p>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 z-0 min-h-0 w-full">
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={{ lat: center[0], lng: center[1] }}
        zoom={zoom}
        mapTypeId="satellite"
        tilt={mode === '3d' ? 45 : 0}
        heading={0}
        options={{
          mapId,
          mapTypeId: 'satellite',
          disableDefaultUI: false,
          zoomControl: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          scaleControl: true,
          rotateControl: false,
        }}
        onLoad={onMapLoad}
        onUnmount={onMapUnmount}
      >
        {position ? (
          <Marker
            position={{ lat: position.lat, lng: position.lng }}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 7,
              fillColor: '#2563eb',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            }}
          />
        ) : null}
      </GoogleMap>

      <GoogleMapsLayers
        map={map}
        mode={mode}
        nativeShowRoute={mode !== '3d' && deckVis.showRoute}
        nativeShowWaypoints={mode !== '3d' && deckVis.showWaypoints}
        weatherTiles={weatherTiles}
      />

      {showPlanOrResults ? (
        <GoogleMapsDeckRouteOverlay
          map={map}
          mapIdDefined={mapIdDefined}
          panel={panel}
          projectId={projectId}
          enabled={
            showPlanOrResults &&
            (mode === '3d' ||
              selectedWaypointId != null ||
              (showResults && showRealFlightPath))
          }
        />
      ) : null}

      <GoogleMapsBottomLeft map={map} showResults={showResults} />
      {/* WindIndicatorOverlay moved to WorkspacePage to respect --right-panel-width */}
    </div>
  )
}

export function GoogleMapsView({ panel, projectId, weatherTiles }: GoogleMapsViewProps) {
  const { googleMapsApiKey } = useMapEngine()
  const hasKey = googleMapsApiKey.length > 0

  if (!hasKey) {
    return (
      <div className="absolute inset-0 z-0 flex flex-col items-center justify-center gap-3 bg-[#0f0f0f] px-6 text-center">
        <p className="text-sm font-medium text-neutral-200">Google Maps</p>
        <p className="max-w-sm text-xs text-neutral-500">
          Defina a chave da API Google Maps em Configuracoes para habilitar este provedor.
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
    <GoogleMapsViewInner
      panel={panel}
      projectId={projectId}
      weatherTiles={weatherTiles}
      googleMapsApiKey={googleMapsApiKey}
    />
  )
}
