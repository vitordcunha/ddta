import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import turfBbox from "@turf/bbox";
import centerOfMass from "@turf/center-of-mass";
import { featureCollection, lineString, polygon } from "@turf/helpers";
import type * as GeoJSON from "geojson";
import { Trash2 } from "lucide-react";
import L, { type DivIcon } from "leaflet";
import {
  CircleMarker,
  Marker,
  Polygon,
  Polyline,
  Popup,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { useMapEngine } from "@/features/map-engine/useMapEngine";
import { DrawingToolbar } from "@/features/flight-planner/components/DrawingToolbar";
import { CrosshairOverlay } from "@/features/flight-planner/components/CrosshairOverlay";
import { FreehandDrawOverlay } from "@/features/flight-planner/components/FreehandDrawOverlay";
import { PolygonEditHandles } from "@/features/flight-planner/components/PolygonEditHandles";
import { createMapboxElevationService } from "@/features/flight-planner/services/elevationService";
import { usePointerPressHighlightOverButton } from "@/features/flight-planner/hooks/usePointerPressHighlightOverButton";
import { useFlightStore } from "@/features/flight-planner/stores/useFlightStore";
import type { FlightStats, Strip, Waypoint } from "@/features/flight-planner/types";
import type { PointOfInterest } from "@/features/flight-planner/types/poi";
import { newPointOfInterest } from "@/features/flight-planner/types/poi";
import { applyTerrainToWaypoints } from "@/features/flight-planner/utils/terrainFollowingApply";
import { buildCalibrationMission } from "@/features/flight-planner/utils/calibrationPlan";
import {
  buildCalibrationWaypointFootprintRings,
  type PhotoPreviewRing,
} from "@/features/flight-planner/utils/calibrationMapPreview";
import {
  closeDraftToPolygon,
  isClickNearFirstVertex,
} from "@/features/flight-planner/utils/polygonDraft";
import {
  attachHoldStillLongPressToElement,
  getEventClientPoint,
  isReleaseOverElement,
  MAP_LONG_PRESS_MARKER_TOUCH_SLOP_PX,
  MAP_LONG_PRESS_MS,
  subscribeHoldStillLongPress,
} from "@/features/flight-planner/utils/mapLongPress";
import { cn } from "@/lib/utils";
import { readUserPreferencesFromStorage } from "@/constants/userPreferences";
import { haptic } from "@/utils/haptics";
import { useDroneModelsQuery } from "@/features/flight-planner/hooks/useDroneModelsQuery";
import {
  profileToCameraParams,
  resolveFlightDroneProfile,
} from "@/features/flight-planner/utils/flightDroneProfile";
import { computeFrustumGeometry } from "@/features/flight-planner/utils/frustumCalculator";
import { toast } from "sonner";

function formatWpLine(w: Waypoint) {
  return `${w.lat.toFixed(6)}, ${w.lng.toFixed(6)} | ${w.altitude}m`;
}

type WaypointRemovalSnapshot = {
  waypoints: Waypoint[];
  strips: Strip[];
  stats: FlightStats | null;
  selectedWaypointId: string | null;
};

function cloneWaypointRemovalSnapshot(state: {
  waypoints: Waypoint[];
  strips: Strip[];
  stats: FlightStats | null;
  selectedWaypointId: string | null;
}): WaypointRemovalSnapshot {
  return {
    waypoints: state.waypoints.map((w) => ({ ...w })),
    strips: state.strips.map((s) => ({
      ...s,
      coordinates: s.coordinates.map((c) => [...c] as [number, number]),
    })),
    stats: state.stats ? { ...state.stats } : null,
    selectedWaypointId: state.selectedWaypointId,
  };
}

/** Mesmo `t` que `buildCalibrationWaypointFootprintRings` usa para a cor da área da foto. */
function calibrationPhotoProgressT(
  waypointIndex0Based: number,
  totalWaypoints: number,
): number {
  return totalWaypoints > 1 ? waypointIndex0Based / (totalWaypoints - 1) : 0;
}

function calibrationPhotoHueFromT(t: number): number {
  return Math.round(188 + t * 92);
}

function photoPreviewPathOptions(t: number) {
  const h = calibrationPhotoHueFromT(t);
  return {
    color: `hsl(${h} 88% 46%)`,
    weight: 1.75,
    fillColor: `hsl(${h} 80% 42%)`,
    fillOpacity: 0.52,
  };
}

function mkMissionWpIcon(dPx: number, fill: string, stroke: string, strokeW: number): DivIcon {
  const pad = 3;
  const size = dPx + pad * 2;
  return L.divIcon({
    className: "plan-wp-mission-icon",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${dPx}px;height:${dPx}px;border-radius:50%;background:${fill};border:${strokeW}px solid ${stroke};box-sizing:border-box;margin:${pad}px;touch-action:none"/>`,
  });
}

function mkPoiIcon(): DivIcon {
  const s = 30;
  return L.divIcon({
    className: "plan-poi-icon",
    iconSize: [s, s],
    iconAnchor: [s / 2, s / 2],
    html: `<div style="width:${s}px;height:${s}px;display:flex;align-items:center;justify-content:center;margin:0;border-radius:50%;background:rgba(6,182,212,0.35);border:2px solid #22d3ee;box-shadow:0 0 0 2px rgba(15,23,42,0.65)">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ecfeff" stroke-width="2" aria-hidden="true">
        <circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/>
        <line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
      </svg>
    </div>`,
  });
}

const POI_LEAFLET_ICON = mkPoiIcon();

function PlanPoiLeafletMarker({ poi }: { poi: PointOfInterest }) {
  const setPoi = useFlightStore((s) => s.setPoi);
  return (
    <Marker
      position={[poi.lat, poi.lng]}
      icon={POI_LEAFLET_ICON}
      zIndexOffset={900}
      draggable
      eventHandlers={{
        dragend: (ev) => {
          const marker = ev.target as L.Marker;
          const ll = marker.getLatLng();
          setPoi({ ...poi, lat: ll.lat, lng: ll.lng });
        },
      }}
    >
      <Tooltip direction="top" offset={[0, -8]}>
        POI — arraste para mover
      </Tooltip>
    </Marker>
  );
}

const WP_MISSION_ICON = {
  single: mkMissionWpIcon(16, "#3ecf8e", "#14532d", 2),
  singleMuted: mkMissionWpIcon(16, "#a8a29e", "#57534e", 2),
  start: mkMissionWpIcon(16, "#3ecf8e", "#14532d", 2),
  startMuted: mkMissionWpIcon(16, "#a8a29e", "#57534e", 2),
  end: mkMissionWpIcon(16, "#f87171", "#7f1d1d", 2),
  endMuted: mkMissionWpIcon(16, "#78716c", "#44403c", 2),
  mid: mkMissionWpIcon(10, "#e5e5e5", "#fafafa", 1),
  midMuted: mkMissionWpIcon(10, "#94a3b8", "#cbd5e1", 1),
} as const;

function MissionWaypointMarkerWithHoldDelete({
  waypoint,
  icon,
  zIndexOffset,
  draggable,
  holdDeleteEnabled,
  tooltip,
  onDragEndForId,
}: {
  waypoint: Waypoint;
  icon: DivIcon;
  zIndexOffset: number;
  draggable: boolean;
  holdDeleteEnabled: boolean;
  tooltip: ReactNode;
  onDragEndForId: (id: string) => (e: L.LeafletEvent) => void;
}) {
  const markerRef = useRef<L.Marker | null>(null);
  const holdCtlRef = useRef<ReturnType<
    typeof attachHoldStillLongPressToElement
  > | null>(null);
  const shouldIgnoreLongPressRef = useRef(false);
  const openedViaHoldRef = useRef(false);
  const deleteBtnRef = useRef<HTMLButtonElement | null>(null);
  const [showDeleteMenu, setShowDeleteMenu] = useState(false);
  const setSelectedWaypoint = useFlightStore((s) => s.setSelectedWaypoint);
  const removeWaypoint = useFlightStore((s) => s.removeWaypoint);
  const waypointCount = useFlightStore((s) => s.waypoints.length);

  const deletePressed = usePointerPressHighlightOverButton(
    showDeleteMenu && waypointCount > 1,
    deleteBtnRef,
  );

  const performDelete = useCallback(() => {
    const st = useFlightStore.getState();
    if (st.waypoints.length <= 1) {
      setShowDeleteMenu(false);
      return;
    }
    const snapshot = cloneWaypointRemovalSnapshot(st);

    if (st.selectedWaypointId === waypoint.id) {
      setSelectedWaypoint(null);
    }
    removeWaypoint(waypoint.id);
    setShowDeleteMenu(false);
    haptic.medium();

    toast("Waypoint removido", {
      action: {
        label: "Desfazer",
        onClick: () => {
          const s = useFlightStore.getState();
          s.setResult(snapshot.waypoints, snapshot.stats, snapshot.strips);
          s.setSelectedWaypoint(snapshot.selectedWaypointId);
          haptic.light();
        },
      },
      duration: 10_000,
    });
  }, [waypoint.id, removeWaypoint, setSelectedWaypoint]);

  const cancelHold = useCallback(() => {
    holdCtlRef.current?.cancelActiveHold();
  }, []);

  useLayoutEffect(() => {
    shouldIgnoreLongPressRef.current = showDeleteMenu;
  }, [showDeleteMenu]);

  useEffect(() => {
    if (!holdDeleteEnabled || showDeleteMenu) return undefined;

    let cancelled = false;
    let raf = 0;
    let attempts = 0;
    let ctl: ReturnType<typeof attachHoldStillLongPressToElement> | null = null;

    const tryAttach = () => {
      if (cancelled) return;
      const el = markerRef.current?.getElement();
      if (!el) {
        attempts += 1;
        if (attempts < 20) {
          raf = requestAnimationFrame(tryAttach);
        }
        return;
      }
      ctl = attachHoldStillLongPressToElement(el, {
        shouldIgnore: () => shouldIgnoreLongPressRef.current,
        slopPx: MAP_LONG_PRESS_MARKER_TOUCH_SLOP_PX,
        onFire: () => {
          openedViaHoldRef.current = true;
          haptic.heavy();
          setShowDeleteMenu(true);
        },
      });
      holdCtlRef.current = ctl;
    };

    tryAttach();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ctl?.detach();
      holdCtlRef.current = null;
    };
  }, [holdDeleteEnabled, waypoint.lat, waypoint.lng, showDeleteMenu]);

  useEffect(() => {
    const m = markerRef.current;
    if (!m) return undefined;
    if (!showDeleteMenu) {
      m.closePopup();
      openedViaHoldRef.current = false;
      return undefined;
    }
    const t = window.setTimeout(() => {
      m.openPopup();
    }, 0);
    return () => clearTimeout(t);
  }, [showDeleteMenu]);

  useEffect(() => {
    if (!showDeleteMenu) return undefined;
    const onRelease = (e: Event) => {
      if (!openedViaHoldRef.current) return;
      openedViaHoldRef.current = false;
      if (useFlightStore.getState().waypoints.length <= 1) return;
      const btn = deleteBtnRef.current;
      if (!btn || !isReleaseOverElement(btn, e)) return;
      e.preventDefault();
      e.stopPropagation();
      performDelete();
    };
    window.addEventListener("pointerup", onRelease, true);
    window.addEventListener("touchend", onRelease, true);
    return () => {
      window.removeEventListener("pointerup", onRelease, true);
      window.removeEventListener("touchend", onRelease, true);
    };
  }, [showDeleteMenu, performDelete]);

  return (
    <Marker
      ref={markerRef}
      position={[waypoint.lat, waypoint.lng]}
      icon={icon}
      draggable={draggable && !showDeleteMenu}
      zIndexOffset={zIndexOffset}
      eventHandlers={{
        click: (e) => {
          L.DomEvent.stopPropagation(e);
          setSelectedWaypoint(waypoint.id);
        },
        dragstart: cancelHold,
        dragend: onDragEndForId(waypoint.id),
        popupclose: () => setShowDeleteMenu(false),
      }}
    >
      {!showDeleteMenu ? <Tooltip direction="top" offset={[0, -8]}>{tooltip}</Tooltip> : null}
      {showDeleteMenu ? (
        <Popup
          offset={[0, -10]}
          className="dd-map-action-popup"
          closeButton
          autoPan
          keepInView
        >
          <div className="flex min-w-[12.5rem] max-w-[min(92vw,16rem)] flex-col">
            <div className="border-b border-white/[0.08] px-3 py-2.5 pr-9">
              <p className="text-sm font-semibold tracking-tight text-neutral-100">Waypoint</p>
              <p className="mt-1 font-mono text-[11px] leading-snug text-neutral-500">
                {formatWpLine(waypoint)}
              </p>
            </div>
            <div className="flex flex-col gap-0.5 p-2">
              {waypointCount > 1 ? (
                <button
                  ref={deleteBtnRef}
                  type="button"
                  className={cn(
                    "touch-target flex min-h-11 w-full items-center gap-2 rounded-lg border border-transparent px-3 text-left text-sm font-medium text-red-400 transition-colors duration-150",
                    "hover:border-red-500/25 hover:bg-red-500/10 active:bg-red-500/15",
                    deletePressed &&
                      "border-red-500/35 bg-red-500/16 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
                  )}
                  onClick={performDelete}
                >
                  <Trash2 className="size-4 shrink-0 opacity-90" aria-hidden />
                  Deletar waypoint
                </button>
              ) : (
                <p className="px-1 py-1.5 text-xs leading-snug text-neutral-400">
                  A rota precisa de pelo menos um waypoint.
                </p>
              )}
              <button
                type="button"
                className={cn(
                  "touch-target flex min-h-11 w-full items-center justify-center rounded-lg px-3 text-sm text-neutral-200 transition-colors",
                  "hover:bg-white/[0.06] active:bg-white/[0.08]",
                )}
                onClick={() => setShowDeleteMenu(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </Popup>
      ) : null}
    </Marker>
  );
}

function PlanMissionWaypointMarkers({
  waypoints,
  muteFullMission,
}: {
  waypoints: Waypoint[];
  muteFullMission: boolean;
}) {
  const { mapboxToken } = useMapEngine();
  const dragTerrainSerial = useRef(0);
  const dragElevationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onDragEnd = useCallback(
    (id: string) => (e: L.LeafletEvent) => {
      const marker = e.target as L.Marker;
      const ll = marker.getLatLng();
      const lat = ll.lat;
      const lng = ll.lng;
      const state = useFlightStore.getState();
      const w0 = state.waypoints.find((x) => x.id === id);
      if (!w0) return;

      const patch: Partial<Waypoint> = { lat, lng };
      state.updateWaypoint(id, patch);

      if (!state.terrainFollowing) return;

      if (dragElevationTimer.current) {
        clearTimeout(dragElevationTimer.current);
        dragElevationTimer.current = null;
      }
      const serial = ++dragTerrainSerial.current;
      const svc = createMapboxElevationService(mapboxToken);
      dragElevationTimer.current = setTimeout(() => {
        dragElevationTimer.current = null;
        const pts = useFlightStore
          .getState()
          .waypoints.map((w) => [w.lat, w.lng] as [number, number]);
        void svc
          .getElevations(pts)
          .then((els) => {
            if (dragTerrainSerial.current !== serial) return;
            const s2 = useFlightStore.getState();
            s2.setResult(
              applyTerrainToWaypoints(s2.waypoints, s2.params.altitudeM, els),
              s2.stats,
              s2.strips,
            );
          })
          .catch(() => {
            if (dragTerrainSerial.current !== serial) return;
            const s2 = useFlightStore.getState();
            const zero = new Array(s2.waypoints.length).fill(0);
            s2.setResult(
              applyTerrainToWaypoints(s2.waypoints, s2.params.altitudeM, zero),
              s2.stats,
              s2.strips,
            );
          });
      }, 300);
    },
    [mapboxToken],
  );

  const draggable = !muteFullMission;
  const holdDeleteEnabled = draggable && waypoints.length > 1;

  if (waypoints.length === 0) return null;

  if (waypoints.length === 1) {
    const w = waypoints[0]!;
    const icon = muteFullMission ? WP_MISSION_ICON.singleMuted : WP_MISSION_ICON.single;
    return (
      <MissionWaypointMarkerWithHoldDelete
        key={`wp-mission-${w.id}`}
        waypoint={w}
        icon={icon}
        zIndexOffset={600}
        draggable={draggable}
        holdDeleteEnabled={false}
        onDragEndForId={onDragEnd}
        tooltip={
          <>
            <span className="font-medium">Inicio e fim da rota</span>
            <br />
            {formatWpLine(w)}
          </>
        }
      />
    );
  }

  const first = waypoints[0]!;
  const last = waypoints[waypoints.length - 1]!;

  return (
    <>
      {waypoints.slice(1, -1).map((waypoint) => {
        const icon = muteFullMission ? WP_MISSION_ICON.midMuted : WP_MISSION_ICON.mid;
        return (
          <MissionWaypointMarkerWithHoldDelete
            key={`wp-mission-${waypoint.id}`}
            waypoint={waypoint}
            icon={icon}
            zIndexOffset={400}
            draggable={draggable}
            holdDeleteEnabled={holdDeleteEnabled}
            onDragEndForId={onDragEnd}
            tooltip={
              <>
                {formatWpLine(waypoint)}
                {holdDeleteEnabled ? (
                  <>
                    <br />
                    <span className="text-[11px] text-neutral-400">Segure para excluir</span>
                  </>
                ) : null}
              </>
            }
          />
        );
      })}
      <MissionWaypointMarkerWithHoldDelete
        key={`wp-mission-start-${first.id}`}
        waypoint={first}
        icon={muteFullMission ? WP_MISSION_ICON.startMuted : WP_MISSION_ICON.start}
        zIndexOffset={600}
        draggable={draggable}
        holdDeleteEnabled={holdDeleteEnabled}
        onDragEndForId={onDragEnd}
        tooltip={
          <>
            <span className="font-medium">Inicio da rota</span>
            <br />
            {formatWpLine(first)}
            {holdDeleteEnabled ? (
              <>
                <br />
                <span className="text-[11px] text-neutral-400">Segure para excluir</span>
              </>
            ) : null}
          </>
        }
      />
      <MissionWaypointMarkerWithHoldDelete
        key={`wp-mission-end-${last.id}`}
        waypoint={last}
        icon={muteFullMission ? WP_MISSION_ICON.endMuted : WP_MISSION_ICON.end}
        zIndexOffset={500}
        draggable={draggable}
        holdDeleteEnabled={holdDeleteEnabled}
        onDragEndForId={onDragEnd}
        tooltip={
          <>
            <span className="font-medium">Fim da rota</span>
            <br />
            {formatWpLine(last)}
            {holdDeleteEnabled ? (
              <>
                <br />
                <span className="text-[11px] text-neutral-400">Segure para excluir</span>
              </>
            ) : null}
          </>
        }
      />
    </>
  );
}

/** Ordem de captura (1-based); cores alinhadas ao footprint do mesmo waypoint. */
function makeCalibrationPhotoOrderIcon(
  order1Based: number,
  totalWaypoints: number,
): DivIcon {
  const label = order1Based > 99 ? "99+" : String(order1Based);
  const t = calibrationPhotoProgressT(order1Based - 1, totalWaypoints);
  const h = calibrationPhotoHueFromT(t);
  const fill = `hsl(${h} 80% 42%)`;
  const stroke = `hsl(${h} 88% 46%)`;
  const style = [
    `background:${fill}`,
    `border:2px solid ${stroke}`,
    "color:#fafafa",
    "text-shadow:0 1px 2px rgba(0,0,0,.55)",
  ].join(";");
  return L.divIcon({
    className: "calibration-photo-order-leaflet-icon",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    html: `<div class="calibration-photo-order-badge" style="${style}" aria-hidden="true">${label}</div>`,
  });
}

function MapFitCalibrationPreview({
  active,
  rings,
  calRingLonLat,
  routeLatLng,
}: {
  active: boolean;
  rings: PhotoPreviewRing[];
  calRingLonLat: [number, number][];
  routeLatLng: [number, number][];
}) {
  const map = useMap();
  useEffect(() => {
    if (!active || calRingLonLat.length < 3) return;
    const lonLatRing = calRingLonLat.map(
      ([lat, lon]) => [lon, lat] as [number, number],
    );
    const feats: GeoJSON.Feature[] = [
      polygon([[...lonLatRing, lonLatRing[0]!]]) as GeoJSON.Feature,
    ];
    for (const r of rings) {
      const closed = r.ringLatLng.map(([lat, lon]) => [lon, lat] as [number, number]);
      if (closed.length >= 3) {
        feats.push(polygon([[...closed, closed[0]!]]) as GeoJSON.Feature);
      }
    }
    if (routeLatLng.length >= 2) {
      feats.push(lineString(routeLatLng.map(([lat, lon]) => [lon, lat])) as GeoJSON.Feature);
    }
    const b = turfBbox(featureCollection(feats));
    map.invalidateSize();
    map.fitBounds(
      [
        [b[1]!, b[0]!],
        [b[3]!, b[2]!],
      ],
      { padding: [48, 48], maxZoom: 19, animate: true },
    );
  }, [active, rings, calRingLonLat, routeLatLng, map]);
  return null;
}

export function FlightPlannerMapContent() {
  const polygon = useFlightStore((s) => s.polygon);
  const poi = useFlightStore((s) => s.poi);
  const selectedWaypointId = useFlightStore((s) => s.selectedWaypointId);
  const waypoints = useFlightStore((s) => s.waypoints);
  const strips = useFlightStore((s) => s.strips);
  const draftPoints = useFlightStore((s) => s.draftPoints);
  const params = useFlightStore((s) => s.params);
  const routeStartRef = useFlightStore((s) => s.routeStartRef);
  const calibrationMapPreviewActive = useFlightStore(
    (s) => s.calibrationMapPreviewActive,
  );
  const plannerInteractionMode = useFlightStore((s) => s.plannerInteractionMode);
  const popLastDraftPoint = useFlightStore((s) => s.popLastDraftPoint);
  const closeDraft = useFlightStore((s) => s.closeDraft);
  const setDraftPoints = useFlightStore((s) => s.setDraftPoints);
  const setPlannerInteractionMode = useFlightStore((s) => s.setPlannerInteractionMode);
  const movePolygonVertex = useFlightStore((s) => s.movePolygonVertex);
  const deletePolygonVertex = useFlightStore((s) => s.deletePolygonVertex);
  const insertPolygonVertex = useFlightStore((s) => s.insertPolygonVertex);

  const isDrawMode = plannerInteractionMode === "draw";
  const crosshairEnabled = readUserPreferencesFromStorage().crosshairDrawMode;
  const map = useMap();

  const handleDrawingCancel = useCallback(() => {
    setDraftPoints([]);
    setPlannerInteractionMode("navigate");
    haptic.medium();
  }, [setDraftPoints, setPlannerInteractionMode]);

  const handleDrawingComplete = useCallback(() => {
    closeDraft();
    setPlannerInteractionMode("navigate");
    haptic.success();
  }, [closeDraft, setPlannerInteractionMode]);

  const handleCrosshairAddVertex = useCallback(() => {
    const c = map.getCenter();
    const latlng: [number, number] = [c.lat, c.lng];
    const store = useFlightStore.getState();
    if (isClickNearFirstVertex(latlng, store.draftPoints)) {
      const closed = closeDraftToPolygon(store.draftPoints);
      if (closed) {
        haptic.success();
        store.setPolygon(closed);
        store.setDraftPoints([]);
        store.setPlannerInteractionMode("navigate");
      }
      return;
    }
    haptic.light();
    store.addDraftPoint(latlng);
  }, [map]);
  const { data: droneCatalog } = useDroneModelsQuery();
  const droneCameraParams = useMemo(
    () => profileToCameraParams(resolveFlightDroneProfile(params, droneCatalog)),
    [params.droneModel, params.droneModelId, droneCatalog],
  );

  const calibrationMission = useMemo(() => {
    if (!calibrationMapPreviewActive || !polygon) return null;
    return buildCalibrationMission(polygon, params, routeStartRef);
  }, [calibrationMapPreviewActive, polygon, params, routeStartRef]);

  const calibrationCenterLat = useMemo(() => {
    if (!calibrationMission) return 0;
    return centerOfMass(calibrationMission.calibrationPolygon).geometry
      .coordinates[1]!;
  }, [calibrationMission]);

  const calibrationPhotoRings = useMemo(() => {
    if (!calibrationMission) return [];
    return buildCalibrationWaypointFootprintRings(
      calibrationMission.waypoints,
      params,
      calibrationCenterLat,
    );
  }, [calibrationMission, params, calibrationCenterLat]);

  const calibrationPolygonLatLng = useMemo(() => {
    if (!calibrationMission) return [];
    return calibrationMission.calibrationPolygon.geometry.coordinates[0].map(
      ([lon, lat]) => [lat, lon] as [number, number],
    );
  }, [calibrationMission]);

  const calibrationRouteLatLng = useMemo(() => {
    if (!calibrationMission) return [];
    return calibrationMission.waypoints.map(
      (w) => [w.lat, w.lng] as [number, number],
    );
  }, [calibrationMission]);

  const calibrationPhotoOrderIcons = useMemo(() => {
    if (!calibrationMission) return null;
    const n = calibrationMission.waypoints.length;
    const byId = new Map<string, DivIcon>();
    calibrationMission.waypoints.forEach((w, i) => {
      byId.set(w.id, makeCalibrationPhotoOrderIcon(i + 1, n));
    });
    return byId;
  }, [calibrationMission]);

  const polygonCoords = useMemo(
    () =>
      polygon?.geometry.coordinates[0].map(
        ([lon, lat]) => [lat, lon] as [number, number],
      ) ?? [],
    [polygon],
  );

  /** Missão completa recuada visualmente enquanto a pré-visualização de calibração está ativa. */
  const muteFullMission = calibrationMapPreviewActive;

  const waypointFovFootprintLatLng = useMemo((): [number, number][] | null => {
    if (!selectedWaypointId) return null;
    const w = waypoints.find((x) => x.id === selectedWaypointId);
    if (!w) return null;
    const g = computeFrustumGeometry(w, droneCameraParams);
    if (!g || g.footprintPolygon.length < 4) return null;
    return g.footprintPolygon.map(([lng, lat]) => [lat, lng] as [number, number]);
  }, [selectedWaypointId, waypoints, droneCameraParams]);

  return (
    <>
      <MapDrawInteraction />
      <MapClearWaypointSelection />
      <MapPlannerCursor />
      <MapGestureLock />
      <MapLongPressWaypoint />
      <FreehandDrawOverlay visible={isDrawMode} />
      <CrosshairOverlay
        visible={isDrawMode && crosshairEnabled}
        onAddVertex={handleCrosshairAddVertex}
      />
      <PolygonEditHandles
        polygon={polygon}
        editable={!isDrawMode && polygon !== null}
        onVertexMove={(i, ll) => movePolygonVertex(i, ll)}
        onVertexDelete={(i) => { haptic.medium(); deletePolygonVertex(i); }}
        onMidpointInsert={(after, ll) => { haptic.light(); insertPolygonVertex(after, ll); }}
      />
      {createPortal(
        <DrawingToolbar
          visible={isDrawMode}
          canUndo={draftPoints.length > 0}
          canComplete={draftPoints.length >= 3}
          onUndo={() => { haptic.light(); popLastDraftPoint(); }}
          onCancel={handleDrawingCancel}
          onComplete={handleDrawingComplete}
        />,
        document.body,
      )}
      {draftPoints.map((pt, i) => {
        const isFirst = i === 0;
        const canCloseHere = isFirst && draftPoints.length > 2;
        return (
          <CircleMarker
            key={`draft-${i}-${pt[0]}-${pt[1]}`}
            center={pt}
            radius={canCloseHere ? 8 : 4}
            pathOptions={{
              color: canCloseHere ? "#3ecf8e" : "#60A5FA",
              weight: canCloseHere ? 2.5 : 1.5,
              fillColor: canCloseHere
                ? "rgba(62, 207, 142, 0.35)"
                : "rgba(96, 165, 250, 0.45)",
              fillOpacity: 0.9,
            }}
          >
            {canCloseHere ? (
              <Tooltip direction="top" offset={[0, -6]}>
                Fechar poligono
              </Tooltip>
            ) : null}
          </CircleMarker>
        );
      })}

      {draftPoints.length > 1 && (
        <Polyline
          positions={draftPoints}
          pathOptions={{ color: "#60A5FA", dashArray: "4 4", weight: 2 }}
        />
      )}

      {polygonCoords.length > 0 && (
        <Polygon
          positions={polygonCoords}
          pathOptions={
            muteFullMission
              ? {
                  color: "#64748b",
                  fillColor: "#475569",
                  fillOpacity: 0.1,
                  weight: 2,
                }
              : {
                  color: "#3ecf8e",
                  fillOpacity: 0.18,
                  weight: 2,
                }
          }
        />
      )}
      {strips.map((strip) => (
        <Polyline
          key={strip.id}
          positions={strip.coordinates.map(([lon, lat]) => [lat, lon])}
          pathOptions={
            muteFullMission
              ? {
                  color: "#94a3b8",
                  weight: 1.5,
                  opacity: 0.38,
                  dashArray: "5 7",
                }
              : { color: "#00c573", weight: 2, opacity: 0.75 }
          }
        />
      ))}
      {waypoints.length > 1 ? (
        <Polyline
          positions={waypoints.map((w) => [w.lat, w.lng])}
          pathOptions={
            muteFullMission
              ? {
                  color: "#78716c",
                  weight: 2,
                  opacity: 0.5,
                  lineCap: "round",
                  lineJoin: "round",
                }
              : {
                  color: "#fbbf24",
                  weight: 3,
                  opacity: 0.92,
                  lineCap: "round",
                  lineJoin: "round",
                }
          }
        />
      ) : null}
      {waypointFovFootprintLatLng && waypointFovFootprintLatLng.length >= 3 ? (
        <Polygon
          positions={waypointFovFootprintLatLng}
          pathOptions={{
            color: "#f59e0b",
            weight: 2,
            fillColor: "#fbbf24",
            fillOpacity: 0.3,
            interactive: false,
          }}
        />
      ) : null}
      <PlanMissionWaypointMarkers
        waypoints={waypoints}
        muteFullMission={muteFullMission}
      />
      {poi ? <PlanPoiLeafletMarker poi={poi} /> : null}

      {calibrationMission && calibrationMapPreviewActive ? (
        <>
          <MapFitCalibrationPreview
            active={calibrationMapPreviewActive}
            rings={calibrationPhotoRings}
            calRingLonLat={calibrationPolygonLatLng}
            routeLatLng={calibrationRouteLatLng}
          />
          <Polygon
            positions={calibrationPolygonLatLng}
            pathOptions={{
              color: "#0284c7",
              weight: 3.5,
              fillColor: "#0ea5e9",
              fillOpacity: 0.32,
            }}
          />
          {calibrationMission.strips.map((strip) => (
            <Polyline
              key={`cal-strip-${strip.id}`}
              positions={strip.coordinates.map(([lon, lat]) => [lat, lon])}
              pathOptions={{
                color: "#06b6d4",
                weight: 3,
                opacity: 1,
                dashArray: "10 7",
              }}
            />
          ))}
          {calibrationRouteLatLng.length > 1 ? (
            <Polyline
              positions={calibrationRouteLatLng}
              pathOptions={{
                color: "#d946ef",
                weight: 5,
                opacity: 1,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
          ) : null}
          {calibrationPhotoRings.map((r) => (
            <Polygon
              key={`cal-photo-${r.id}`}
              positions={r.ringLatLng}
              pathOptions={photoPreviewPathOptions(r.t)}
            />
          ))}
          {calibrationPhotoOrderIcons
            ? calibrationMission.waypoints.map((w, i) => {
                const icon = calibrationPhotoOrderIcons.get(w.id);
                if (!icon) return null;
                return (
                  <Marker
                    key={`cal-photo-order-${w.id}`}
                    position={[w.lat, w.lng]}
                    icon={icon}
                    zIndexOffset={800}
                  >
                    <Tooltip direction="top" offset={[0, -14]}>
                      <span className="font-medium">Foto {i + 1}</span> — ordem
                      de captura
                      <br />
                      {formatWpLine(w)}
                    </Tooltip>
                  </Marker>
                );
              })
            : null}
        </>
      ) : null}
    </>
  );
}

/**
 * Clicks no mapa: so em modo desenho; clique no primeiro ponto
 * (com mais de 4 pontos / 5+ vertices) fecha o poligono.
 */
/** Em modo navegar: clique no mapa (fora dos marcadores) limpa o waypoint selecionado. */
function MapClearWaypointSelection() {
  useMapEvents({
    click: () => {
      const st = useFlightStore.getState();
      if (st.poiPlacementActive) return;
      if (st.plannerInteractionMode !== "navigate") return;
      if (st.selectedWaypointId) st.setSelectedWaypoint(null);
    },
  });
  return null;
}

function MapDrawInteraction() {
  useMapEvents({
    click: (e) => {
      const st = useFlightStore.getState();
      if (st.poiPlacementActive) {
        if (st.poi) {
          st.setPoi({ ...st.poi, lat: e.latlng.lat, lng: e.latlng.lng });
        } else {
          st.setPoi(
            newPointOfInterest(
              e.latlng.lat,
              e.latlng.lng,
              st.waypoints,
              st.params.altitudeM,
            ),
          );
        }
        return;
      }
      const {
        plannerInteractionMode,
        draftPoints,
        addDraftPoint,
        setDraftPoints,
        setPolygon,
      } = useFlightStore.getState();
      if (plannerInteractionMode !== "draw") return;
      const latlng: [number, number] = [e.latlng.lat, e.latlng.lng];
      if (isClickNearFirstVertex(latlng, draftPoints)) {
        const closed = closeDraftToPolygon(draftPoints);
        if (closed) {
          haptic.success();
          setPolygon(closed);
          setDraftPoints([]);
        }
        return;
      }
      haptic.light();
      addDraftPoint(latlng);
    },
  });
  return null;
}

function MapPlannerCursor() {
  const mode = useFlightStore((s) => s.plannerInteractionMode);
  const poiPlacementActive = useFlightStore((s) => s.poiPlacementActive);
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    el.style.cursor =
      mode === "draw" || poiPlacementActive ? "crosshair" : "";
    return () => {
      el.style.cursor = "";
    };
  }, [map, mode, poiPlacementActive]);
  return null;
}

/** Módulo 6: Long press no mapa em modo navigate adiciona waypoint manual. */
function MapLongPressWaypoint() {
  const mode = useFlightStore((s) => s.plannerInteractionMode);
  const waypoints = useFlightStore((s) => s.waypoints);
  const addManualWaypoint = useFlightStore((s) => s.addManualWaypoint);
  const map = useMap();
  const mapHoldCancelRef = useRef<(() => void) | null>(null);

  useEffect(
    () => () => {
      mapHoldCancelRef.current?.();
      mapHoldCancelRef.current = null;
    },
    [],
  );

  useMapEvents({
    mousedown: (e) => {
      if (mode !== "navigate") return;
      if (useFlightStore.getState().poiPlacementActive) return;
      mapHoldCancelRef.current?.();
      mapHoldCancelRef.current = null;
      const pt = getEventClientPoint(e.originalEvent);
      const latlng = e.latlng;
      const runAdd = () => {
        const alt =
          waypoints.length > 0
            ? waypoints.reduce((sum, w) => sum + w.altitude, 0) / waypoints.length
            : useFlightStore.getState().params.altitudeM;
        haptic.heavy();
        addManualWaypoint([latlng.lat, latlng.lng], alt);
      };
      if (!pt) {
        let cancel: () => void;
        const finishListeners = () => {
          map.off("mouseup", cancel);
          map.off("mousemove", cancel);
        };
        const timer = window.setTimeout(() => {
          finishListeners();
          mapHoldCancelRef.current = null;
          runAdd();
        }, MAP_LONG_PRESS_MS);
        cancel = () => {
          window.clearTimeout(timer);
          finishListeners();
          mapHoldCancelRef.current = null;
        };
        mapHoldCancelRef.current = cancel;
        map.on("mouseup", cancel);
        map.on("mousemove", cancel);
        return;
      }
      mapHoldCancelRef.current = subscribeHoldStillLongPress(pt, () => {
        mapHoldCancelRef.current = null;
        runAdd();
      });
    },
  });
  return null;
}

/** Módulo 8: desabilita gestos conflitantes ao entrar em modo desenho. */
function MapGestureLock() {
  const mode = useFlightStore((s) => s.plannerInteractionMode);
  const { disableDrawConflictGestures, enableDrawConflictGestures } = useMapEngine();
  useEffect(() => {
    if (mode === "draw") {
      disableDrawConflictGestures();
    } else {
      enableDrawConflictGestures();
    }
    return () => {
      enableDrawConflictGestures();
    };
  }, [mode, disableDrawConflictGestures, enableDrawConflictGestures]);
  return null;
}
