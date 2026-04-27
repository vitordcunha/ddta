import { useEffect } from "react";
import { MapContainer, useMap } from "react-leaflet";
import { MapUserLocationLayers } from "@/components/map/MapUserLocation";
import { PlannerMapBaseLayer } from "@/components/map/PlannerMapBaseLayer";
import { FlightPlannerMapContent } from "@/features/flight-planner/components/FlightPlannerMapContent";
import { ResultsMapInnerLayers } from "@/features/results/components/ResultsMapLayers";
import type { WorkspacePanelId } from "@/constants/routes";
import { MapBootstrapView } from "@/components/map/MapBootstrapView";
import { PlannerWeatherMapLayers } from "@/components/map/PlannerWeatherMapLayers";
import type { WorkspaceMapWeatherTilesProps } from "@/components/map/useWorkspaceMapWeather";
import { useGeolocationContext } from "@/hooks/GeolocationContext";
import L from "leaflet";
import { useMapBootstrapFocus } from "@/hooks/useMapBootstrapFocus";
import { useMapEngine } from "@/features/map-engine/useMapEngine";
import "leaflet/dist/leaflet.css";

/** Duração em s alinhada ao padrão de `zoomAnimation` do Leaflet (~0.25s). */
const SMOOTH_ZOOM_PAN: L.ZoomPanOptions = {
  animate: true,
  duration: 0.25,
};

const SMOOTH_FIT: L.FitBoundsOptions = {
  ...SMOOTH_ZOOM_PAN,
  maxZoom: 20,
};

/**
 * Registra a API imperativa do Leaflet no MapEngineContext para que componentes
 * agnósticos ao provider possam operar o mapa (pan, zoom, gestos).
 */
function LeafletMapApiRegistrar() {
  const map = useMap();
  const { registerMapApi } = useMapEngine();

  useEffect(() => {
    registerMapApi({
      getCenter: () => {
        const c = map.getCenter();
        return [c.lat, c.lng];
      },
      disablePan: () => map.dragging.disable(),
      enablePan: () => map.dragging.enable(),
      // Leaflet não tem rotate/tilt nativo
      disableDrawConflictGestures: () => {},
      enableDrawConflictGestures: () => {},
      setBearing: () => {},
      changePitch: () => {},
      changeZoom: (delta) => {
        if (delta > 0) map.zoomIn(1, SMOOTH_ZOOM_PAN);
        else map.zoomOut(1, SMOOTH_ZOOM_PAN);
      },
      fitBounds: (bounds, padding = 32) => {
        const [[south, west], [north, east]] = bounds;
        const pad = [padding, padding] as L.PointExpression;
        map.fitBounds(
          L.latLngBounds(
            L.latLng(south, west),
            L.latLng(north, east),
          ),
          { ...SMOOTH_FIT, padding: pad },
        );
      },
    });
    return () => {
      registerMapApi({});
    };
  }, [map, registerMapApi]);

  return null;
}

type LeafletMapViewProps = {
  panel: WorkspacePanelId;
  projectId: string | null;
  weatherTiles: WorkspaceMapWeatherTilesProps;
};

function LeafletViewSync() {
  const map = useMap();
  const { center, zoom, setCenterZoom } = useMapEngine();

  useEffect(() => {
    const onMoveEnd = () => {
      const c = map.getCenter();
      setCenterZoom([c.lat, c.lng], map.getZoom());
    };
    map.on("moveend", onMoveEnd);
    return () => {
      map.off("moveend", onMoveEnd);
    };
  }, [map, setCenterZoom]);

  useEffect(() => {
    const mc = map.getCenter();
    const z = map.getZoom();
    const sameLat = Math.abs(mc.lat - center[0]) < 1e-7;
    const sameLng = Math.abs(mc.lng - center[1]) < 1e-7;
    if (sameLat && sameLng && z === zoom) return;
    map.setView(center, zoom, SMOOTH_ZOOM_PAN);
  }, [center, zoom, map]);

  return null;
}

export function LeafletMapView({
  panel,
  projectId,
  weatherTiles,
}: LeafletMapViewProps) {
  const showPlan = panel === "plan" && Boolean(projectId);
  const showResults = panel === "results" && Boolean(projectId);
  const { position, locate } = useGeolocationContext();
  const bootstrapFocus = useMapBootstrapFocus({ locate });
  const { center, zoom, setCenterZoom } = useMapEngine();

  useEffect(() => {
    if (!bootstrapFocus) return;
    setCenterZoom(bootstrapFocus.center, bootstrapFocus.zoom);
  }, [bootstrapFocus, setCenterZoom]);

  const userLocationLayers = <MapUserLocationLayers position={position} />;

  const weatherTileLayers = (
    <PlannerWeatherMapLayers
      overlay={weatherTiles.overlay}
      openWeatherApiKey={weatherTiles.openWeatherApiKey}
      onRadarStatus={weatherTiles.onRadarStatus}
    />
  );

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
        <LeafletMapApiRegistrar />
        <MapBootstrapView focus={bootstrapFocus} />
        {showResults ? (
          <>
            <ResultsMapInnerLayers projectId={projectId} />
            {userLocationLayers}
            {weatherTileLayers}
          </>
        ) : (
          <>
            <PlannerMapBaseLayer />
            {userLocationLayers}
            {weatherTileLayers}
            {showPlan ? <FlightPlannerMapContent /> : null}
          </>
        )}
      </MapContainer>
    </div>
  );
}
