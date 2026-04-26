import { useCallback, useEffect, useMemo, useState } from "react";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { Link } from "react-router-dom";
import type { WorkspacePanelId } from "@/constants/routes";
import { toWorkspace } from "@/constants/routes";
import type { WorkspaceMapWeatherTilesProps } from "@/components/map/useWorkspaceMapWeather";
import { useMapEngine } from "@/features/map-engine/useMapEngine";
import { useFlightStore } from "@/features/flight-planner/stores/useFlightStore";
import { useResultsViewStore } from "@/features/results/stores/useResultsViewStore";
import { useMapBootstrapFocus } from "@/hooks/useMapBootstrapFocus";
import { useGeolocation } from "@/hooks/useGeolocation";
import { newPointOfInterest } from "@/features/flight-planner/types/poi";
import {
  closeDraftToPolygon,
  isClickNearFirstVertex,
} from "@/features/flight-planner/utils/polygonDraft";
import { GoogleMapsLayers } from "@/features/map-engine/providers/google/GoogleMapsLayers";
import { GoogleMapsDeckRouteOverlay } from "@/features/map-engine/providers/google/GoogleMapsDeckRouteOverlay";
import { GoogleMapsBottomLeft } from "@/features/map-engine/providers/google/GoogleMapsBottomLeft";
import { useGoogleMapsSync } from "@/features/map-engine/providers/google/useGoogleMapsSync";
import { GoogleMapsPhotorealisticPane } from "@/features/map-engine/providers/google/GoogleMapsPhotorealisticPane";
import type { Map3DElementInstance } from "@/features/map-engine/providers/google/GoogleMapsPhotorealisticPane";
import {
  buildGoogleWorkspaceClassicMapOptions,
  googleWorkspaceClassicMapTypeId,
} from "@/features/map-engine/providers/google/googleMapsWorkspaceBasemap";

type GoogleMapsViewProps = {
  panel: WorkspacePanelId;
  projectId: string | null;
  weatherTiles: WorkspaceMapWeatherTilesProps;
};

function readGoogleMapsMapId(): string | undefined {
  const raw = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string | undefined;
  const t = raw?.trim();
  return t && t.length > 0 ? t : undefined;
}

/**
 * Painel resultados em 3D continua no mapa classico (Deck + trilha real).
 * Painel plano em 3D usa mapa imersivo (predios/vegetacao fotorealisticos).
 */
function usePhotorealistic3dForPanel(
  panel: WorkspacePanelId,
  mode: "2d" | "3d",
): boolean {
  return mode === "3d" && panel === "plan";
}

function GoogleMapsViewInner({
  panel,
  projectId,
  weatherTiles,
  googleMapsApiKey,
}: GoogleMapsViewProps & { googleMapsApiKey: string }) {
  const showPlan = panel === "plan" && Boolean(projectId);
  const showResults = panel === "results" && Boolean(projectId);
  const showPlanOrResults = showPlan || showResults;
  const { position, locate } = useGeolocation();
  const bootstrapFocus = useMapBootstrapFocus({ locate });
  const { mode, center, zoom, setCenterZoom } = useMapEngine();
  const deckVis = useFlightStore((s) =>
    panel === "results"
      ? s.deckMapVisibility.results
      : s.deckMapVisibility.plan,
  );
  const showRealFlightPath = useResultsViewStore((s) => s.showRealFlightPath);
  const selectedWaypointId = useFlightStore((s) => s.selectedWaypointId);
  const poiPlacementActive = useFlightStore((s) => s.poiPlacementActive);
  const plannerInteractionMode = useFlightStore(
    (s) => s.plannerInteractionMode,
  );

  const mapId = readGoogleMapsMapId();
  const mapIdDefined = Boolean(mapId);

  const photorealistic3d = usePhotorealistic3dForPanel(panel, mode);
  const [immersive3dFailed, setImmersive3dFailed] = useState(false);
  const useImmersivePane = photorealistic3d && !immersive3dFailed;

  useEffect(() => {
    if (!photorealistic3d) {
      queueMicrotask(() => setImmersive3dFailed(false));
    }
  }, [photorealistic3d]);

  const { isLoaded, loadError } = useJsApiLoader({
    id: "dronedata-google-maps-loader",
    googleMapsApiKey,
    version: "weekly",
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [map3dElement, setMap3dElement] = useState<Map3DElementInstance | null>(
    null,
  );

  useGoogleMapsSync(useImmersivePane ? null : map);

  const classicMapOptions = useMemo(
    () => buildGoogleWorkspaceClassicMapOptions({ mapId, mode }),
    [mapId, mode],
  );

  useEffect(() => {
    if (!bootstrapFocus) return;
    setCenterZoom(bootstrapFocus.center, bootstrapFocus.zoom);
  }, [bootstrapFocus, setCenterZoom]);

  useEffect(() => {
    if (!map || useImmersivePane) return;
    map.setTilt(mode === "3d" ? 45 : 0);
    map.setHeading(0);
    const mt = classicMapOptions.mapTypeId;
    if (typeof mt === "string") map.setMapTypeId(mt);
    else if (mt != null) map.setMapTypeId(mt);
  }, [map, mode, useImmersivePane, classicMapOptions.mapTypeId]);

  useEffect(() => {
    if (!map || !showPlan || useImmersivePane) return;

    const listener = map.addListener(
      "click",
      (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();

        const st = useFlightStore.getState();
        if (st.poiPlacementActive) {
          if (st.poi) {
            st.setPoi({ ...st.poi, lat, lng });
          } else {
            st.setPoi(
              newPointOfInterest(lat, lng, st.waypoints, st.params.altitudeM),
            );
          }
          return;
        }
        if (st.plannerInteractionMode !== "draw") return;
        const latlng: [number, number] = [lat, lng];
        const { draftPoints, addDraftPoint, setDraftPoints, setPolygon } = st;
        if (isClickNearFirstVertex(latlng, draftPoints)) {
          const closed = closeDraftToPolygon(draftPoints);
          if (closed) {
            setPolygon(closed);
            setDraftPoints([]);
          }
          return;
        }
        addDraftPoint(latlng);
      },
    );

    return () => {
      listener.remove();
    };
  }, [
    map,
    showPlan,
    useImmersivePane,
    poiPlacementActive,
    plannerInteractionMode,
  ]);

  useEffect(() => {
    if (!map || !showPlan || !poiPlacementActive || useImmersivePane) return;
    map.setOptions({ draggableCursor: "crosshair" });
    return () => {
      map.setOptions({ draggableCursor: undefined });
    };
  }, [map, showPlan, poiPlacementActive, useImmersivePane]);

  const onMapLoad = useCallback((m: google.maps.Map) => {
    setMap(m);
  }, []);

  const onMapUnmount = useCallback(() => {
    setMap(null);
  }, []);

  const onViewportFromImmersive = useCallback(
    (c: [number, number], z: number) => {
      setCenterZoom(c, z);
    },
    [setCenterZoom],
  );

  const onImmersiveLoadError = useCallback(() => {
    setImmersive3dFailed(true);
  }, []);

  if (loadError) {
    return (
      <div className="absolute inset-0 z-0 flex flex-col items-center justify-center gap-3 bg-[#0f0f0f] px-6 text-center">
        <p className="text-sm font-medium text-neutral-200">Google Maps</p>
        <p className="max-w-sm text-xs text-red-300/90">
          Falha ao carregar a API do Google Maps. Verifique a chave e as
          restricoes no Google Cloud.
        </p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="absolute inset-0 z-0 flex items-center justify-center bg-[#0f0f0f]">
        <p className="text-xs text-neutral-500">Carregando Google Maps…</p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-0 min-h-0 w-full">
      {useImmersivePane ? (
        <GoogleMapsPhotorealisticPane
          center={center}
          zoom={zoom}
          mapId={mapId}
          showPlan={showPlan}
          onViewportFromCamera={onViewportFromImmersive}
          onMap3dElementChange={setMap3dElement}
          onLoadError={onImmersiveLoadError}
        />
      ) : (
        <GoogleMap
          mapContainerStyle={{ width: "100%", height: "100%" }}
          center={{ lat: center[0], lng: center[1] }}
          zoom={zoom}
          mapTypeId={
            googleWorkspaceClassicMapTypeId(mode) as google.maps.MapTypeId
          }
          tilt={mode === "3d" ? 45 : 0}
          heading={0}
          options={classicMapOptions}
          onLoad={onMapLoad}
          onUnmount={onMapUnmount}
        >
          {position ? (
            <Marker
              position={{ lat: position.lat, lng: position.lng }}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 7,
                fillColor: "#2563eb",
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 2,
              }}
            />
          ) : null}
        </GoogleMap>
      )}

      {!useImmersivePane ? (
        <GoogleMapsLayers
          map={map}
          mode={mode}
          nativeShowRoute={mode !== "3d" && deckVis.showRoute}
          nativeShowWaypoints={mode !== "3d" && deckVis.showWaypoints}
          weatherTiles={weatherTiles}
        />
      ) : null}

      {showPlanOrResults && !useImmersivePane ? (
        <GoogleMapsDeckRouteOverlay
          map={map}
          mapIdDefined={mapIdDefined}
          panel={panel}
          projectId={projectId}
          enabled={
            showPlanOrResults &&
            (mode === "3d" ||
              selectedWaypointId != null ||
              (showResults && showRealFlightPath))
          }
        />
      ) : null}

      <GoogleMapsBottomLeft
        map={useImmersivePane ? null : map}
        map3dElement={useImmersivePane ? map3dElement : null}
        showResults={showResults}
      />
    </div>
  );
}

export function GoogleMapsView({
  panel,
  projectId,
  weatherTiles,
}: GoogleMapsViewProps) {
  const { googleMapsApiKey } = useMapEngine();
  const hasKey = googleMapsApiKey.length > 0;

  if (!hasKey) {
    return (
      <div className="absolute inset-0 z-0 flex flex-col items-center justify-center gap-3 bg-[#0f0f0f] px-6 text-center">
        <p className="text-sm font-medium text-neutral-200">Google Maps</p>
        <p className="max-w-sm text-xs text-neutral-500">
          Defina a chave da API Google Maps em Configuracoes para habilitar este
          provedor.
        </p>
        <Link
          className="text-xs font-medium text-primary-400 underline-offset-2 hover:underline"
          to={toWorkspace("/", { panel: "settings" })}
        >
          Abrir configuracoes
        </Link>
      </div>
    );
  }

  return (
    <GoogleMapsViewInner
      panel={panel}
      projectId={projectId}
      weatherTiles={weatherTiles}
      googleMapsApiKey={googleMapsApiKey}
    />
  );
}
