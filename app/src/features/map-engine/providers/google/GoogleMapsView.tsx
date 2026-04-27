import { useCallback, useEffect, useMemo, useState } from "react";
import { GoogleMap, useJsApiLoader } from "@react-google-maps/api";
import { Link } from "react-router-dom";
import type { WorkspacePanelId } from "@/constants/routes";
import { toWorkspace } from "@/constants/routes";
import type { WorkspaceMapWeatherTilesProps } from "@/components/map/useWorkspaceMapWeather";
import { useMapEngine } from "@/features/map-engine/useMapEngine";
import { useFlightStore } from "@/features/flight-planner/stores/useFlightStore";
import { useResultsViewStore } from "@/features/results/stores/useResultsViewStore";
import { useMapBootstrapFocus } from "@/hooks/useMapBootstrapFocus";
import { useGeolocationContext } from "@/hooks/GeolocationContext";
import { newPointOfInterest } from "@/features/flight-planner/types/poi";
import {
  closeDraftToPolygon,
  isClickNearFirstVertex,
} from "@/features/flight-planner/utils/polygonDraft";
import { GoogleMapsLayers } from "@/features/map-engine/providers/google/GoogleMapsLayers";
import { GoogleMapsDeckRouteOverlay } from "@/features/map-engine/providers/google/GoogleMapsDeckRouteOverlay";
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
  layoutRevision?: number;
};

function readGoogleMapsMapId(): string | undefined {
  const raw = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string | undefined;
  const t = raw?.trim();
  return t && t.length > 0 ? t : undefined;
}

/** Marcador de posição do usuário usando AdvancedMarkerElement (substitui Marker deprecated). */
/**
 * Marcador de posição do usuário via OverlayView (HTML puro).
 * Não usa google.maps.Marker (deprecated) nem AdvancedMarkerElement (exige mapId).
 */
function GoogleMapsUserPositionMarker({
  map,
  position,
}: {
  map: google.maps.Map | null;
  position: { lat: number; lng: number } | null;
}) {
  useEffect(() => {
    if (!map || !position) return;

    class DotOverlay extends google.maps.OverlayView {
      private _pos: google.maps.LatLngLiteral;
      private _div: HTMLDivElement | null = null;

      constructor(pos: google.maps.LatLngLiteral) {
        super();
        this._pos = pos;
      }

      onAdd() {
        const div = document.createElement("div");
        div.style.cssText =
          "position:absolute;width:14px;height:14px;border-radius:50%;" +
          "background:#2563eb;border:2.5px solid #fff;" +
          "box-shadow:0 1px 4px rgba(0,0,0,.35);transform:translate(-50%,-50%);" +
          "pointer-events:none";
        this._div = div;
        this.getPanes()!.overlayLayer.appendChild(div);
      }

      draw() {
        const proj = this.getProjection();
        if (!proj || !this._div) return;
        const point = proj.fromLatLngToDivPixel(
          new google.maps.LatLng(this._pos.lat, this._pos.lng),
        );
        if (point) {
          this._div.style.left = `${point.x}px`;
          this._div.style.top = `${point.y}px`;
        }
      }

      onRemove() {
        if (this._div?.parentNode) this._div.parentNode.removeChild(this._div);
        this._div = null;
      }
    }

    const overlay = new DotOverlay(position);
    overlay.setMap(map);

    return () => {
      overlay.setMap(null);
    };
  }, [map, position?.lat, position?.lng]);

  return null;
}

/**
 * Retorna true quando o modo imersivo (Map3DElement com prédios/vegetação) deve ser usado.
 * Ativado em qualquer painel quando o usuário optou por "immersive" via modal de confirmação.
 */
function usePhotorealistic3d(
  mode: "2d" | "3d",
  google3dPreference: "immersive" | "classic" | null,
): boolean {
  return mode === "3d" && google3dPreference === "immersive";
}

function GoogleMapsViewInner({
  panel,
  projectId,
  weatherTiles,
  layoutRevision,
  googleMapsApiKey,
}: GoogleMapsViewProps & { googleMapsApiKey: string }) {
  const showPlan = panel === "plan" && Boolean(projectId);
  const showResults = panel === "results" && Boolean(projectId);
  const showPlanOrResults = showPlan || showResults;
  const { position, locate } = useGeolocationContext();
  const bootstrapFocus = useMapBootstrapFocus({ locate });
  const { mode, center, zoom, setCenterZoom, google3dPreference } = useMapEngine();
  const deckVis = useFlightStore((s) =>
    panel === "results"
      ? s.deckMapVisibility.results
      : s.deckMapVisibility.plan,
  );
  const showRealFlightPath = useResultsViewStore((s) => s.showRealFlightPath);
  const selectedWaypointId = useFlightStore((s) => s.selectedWaypointId);
  const poiPlacementActive = useFlightStore((s) => s.poiPlacementActive);
  const plannerBaseLayer = useFlightStore((s) => s.plannerBaseLayer);
  const plannerInteractionMode = useFlightStore(
    (s) => s.plannerInteractionMode,
  );

  const mapId = readGoogleMapsMapId();
  const mapIdDefined = Boolean(mapId);

  const photorealistic3d = usePhotorealistic3d(mode, google3dPreference);
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
  const [, setMap3dElement] = useState<Map3DElementInstance | null>(null);

  useEffect(() => {
    if (!map || layoutRevision === undefined) return;
    const id = requestAnimationFrame(() => {
      google.maps.event.trigger(map, "resize");
    });
    return () => cancelAnimationFrame(id);
  }, [map, layoutRevision]);

  useGoogleMapsSync(useImmersivePane ? null : map);

  const classicMapOptions = useMemo(
    () =>
      buildGoogleWorkspaceClassicMapOptions({
        mapId,
        mode,
        plannerBaseLayer,
      }),
    [mapId, mode, plannerBaseLayer],
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
    const st = classicMapOptions.styles;
    map.setOptions({ styles: st && st.length > 0 ? st : [] });
  }, [
    map,
    mode,
    useImmersivePane,
    classicMapOptions.mapTypeId,
    classicMapOptions.styles,
  ]);

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
        if (st.plannerInteractionMode !== "draw") {
          if (st.selectedWaypointId) st.setSelectedWaypoint(null);
          return;
        }
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
          panel={panel}
          showPlan={showPlan}
          showResults={showResults}
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
            googleWorkspaceClassicMapTypeId(
              mode,
              plannerBaseLayer,
            ) as google.maps.MapTypeId
          }
          tilt={mode === "3d" ? 45 : 0}
          heading={0}
          options={classicMapOptions}
          onLoad={onMapLoad}
          onUnmount={onMapUnmount}
        />
      )}
      {/* Marcador de posição gerenciado fora do GoogleMap para evitar uso do Marker deprecated */}
      {!useImmersivePane ? (
        <GoogleMapsUserPositionMarker
          map={map}
          position={position ? { lat: position.lat, lng: position.lng } : null}
        />
      ) : null}
      {!useImmersivePane ? (
        <GoogleMapsLayers
          map={map}
          mode={mode}
          nativeShowRoute={mode !== "3d" && deckVis.showRoute}
          nativeShowWaypoints={mode !== "3d" && deckVis.showWaypoints}
          weatherTiles={weatherTiles}
        />
      ) : null}

      {/*
        Mantemos o componente sempre montado (quando há plan/results) mas passamos map=null
        quando useImmersivePane=true. Isso força o DeckGLGoogleOverlay a chamar
        overlay.setMap(null) ANTES do GoogleMap clássico desmontar e destruir o contexto
        WebGL, evitando "Cannot read properties of null (addListener)" e erros de WebGL.
      */}
      {showPlanOrResults ? (
        <GoogleMapsDeckRouteOverlay
          map={useImmersivePane ? null : map}
          mapIdDefined={mapIdDefined}
          panel={panel}
          projectId={projectId}
          enabled={
            !useImmersivePane &&
            showPlanOrResults &&
            (mode === "3d" ||
              selectedWaypointId != null ||
              (showResults && showRealFlightPath))
          }
        />
      ) : null}

    </div>
  );
}

export function GoogleMapsView({
  panel,
  projectId,
  weatherTiles,
  layoutRevision,
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
      layoutRevision={layoutRevision}
      googleMapsApiKey={googleMapsApiKey}
    />
  );
}
