import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import turfBbox from "@turf/bbox";
import centerOfMass from "@turf/center-of-mass";
import { featureCollection, lineString, polygon } from "@turf/helpers";
import type * as GeoJSON from "geojson";
import { Crosshair, MapPin, Navigation, Trash2 } from "lucide-react";
import L, { type DivIcon } from "leaflet";
import {
  Marker,
  Polygon,
  Polyline,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import {
  MappingPolygonAnimated,
  RoutePolylineAnimated,
} from "@/features/flight-planner/components/PlanLeafletPathAnimations";
import { useMapEngine } from "@/features/map-engine/useMapEngine";
import {
  FlightPlannerMapDraftLayer,
  FlightPlannerMapMissionPolygon,
  FlightPlannerMapMissionStrips,
} from "@/features/flight-planner/components/FlightPlannerMapLayers";
import { CrosshairOverlay } from "@/features/flight-planner/components/CrosshairOverlay";
import { FreehandDrawOverlay } from "@/features/flight-planner/components/FreehandDrawOverlay";
import { PolygonEditHandles } from "@/features/flight-planner/components/PolygonEditHandles";
import { createMapboxElevationService } from "@/features/flight-planner/services/elevationService";
import { useFlightStore } from "@/features/flight-planner/stores/useFlightStore";
import type { Waypoint } from "@/features/flight-planner/types";
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
  MAP_LONG_PRESS_MARKER_TOUCH_SLOP_PX,
  MAP_LONG_PRESS_MS,
  subscribeHoldStillLongPress,
} from "@/features/flight-planner/utils/mapLongPress";
import { readUserPreferencesFromStorage } from "@/constants/userPreferences";
import { haptic } from "@/utils/haptics";
import { useDroneModelsQuery } from "@/features/flight-planner/hooks/useDroneModelsQuery";
import {
  profileToCameraParams,
  resolveFlightDroneProfile,
} from "@/features/flight-planner/utils/flightDroneProfile";
import { computeFrustumGeometry } from "@/features/flight-planner/utils/frustumCalculator";
import { toast } from "sonner";
import {
  RadialContextMenu,
  type RadialMenuItem,
} from "@/features/map-engine/components/RadialContextMenu";

function formatWpLine(w: Waypoint) {
  return `${w.lat.toFixed(6)}, ${w.lng.toFixed(6)} | ${w.altitude}m`;
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
    html: `<div class="plan-wp-mission-inner" style="width:${dPx}px;height:${dPx}px;border-radius:50%;background:${fill};border:${strokeW}px solid ${stroke};box-sizing:border-box;margin:${pad}px;touch-action:none"/>`,
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

/** Uma animação de entrada por waypoint; reset ao desmontar (incl. "desfazer"). */
const waypointsEnterAnimationPlayed = new Set<string>();

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
  const holdCtlRef = useRef<ReturnType<typeof attachHoldStillLongPressToElement> | null>(null);
  const shouldIgnoreLongPressRef = useRef(false);
  const openedViaHoldRef = useRef(false);
  const pressCoordRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showMenu, setShowMenu] = useState(false);

  const setSelectedWaypoint = useFlightStore((s) => s.setSelectedWaypoint);
  const removeWaypoint = useFlightStore((s) => s.removeWaypoint);
  const setRouteStartRef = useFlightStore((s) => s.setRouteStartRef);
  const waypointCount = useFlightStore((s) => s.waypoints.length);

  // Animação de entrada
  useLayoutEffect(() => {
    if (waypointsEnterAnimationPlayed.has(waypoint.id)) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      waypointsEnterAnimationPlayed.add(waypoint.id);
      return;
    }
    const el = markerRef.current?.getElement();
    if (!el) return;
    const inner = el.querySelector(".plan-wp-mission-inner");
    if (!inner) return;
    waypointsEnterAnimationPlayed.add(waypoint.id);
    inner.classList.add("dd-wp-entra");
    const onEnd = () => inner.classList.remove("dd-wp-entra");
    inner.addEventListener("animationend", onEnd, { once: true });
    return () => { waypointsEnterAnimationPlayed.delete(waypoint.id); };
  }, [waypoint.id, waypoint.lat, waypoint.lng]);

  const performDelete = useCallback(() => {
    if (waypointCount <= 1) { setShowMenu(false); return; }
    if (useFlightStore.getState().selectedWaypointId === waypoint.id) {
      setSelectedWaypoint(null);
    }
    removeWaypoint(waypoint.id);
    setShowMenu(false);
    haptic.medium();
    toast("Waypoint removido", {
      action: {
        label: "Desfazer",
        onClick: () => {
          useFlightStore.getState().undo();
          haptic.light();
        },
      },
      duration: 10_000,
    });
  }, [waypoint.id, waypointCount, removeWaypoint, setSelectedWaypoint]);

  const performSetRouteStart = useCallback(() => {
    setRouteStartRef({ lat: waypoint.lat, lng: waypoint.lng });
    setShowMenu(false);
    haptic.light();
    toast("Ponto de início da rota definido", { duration: 2500 });
  }, [waypoint.lat, waypoint.lng, setRouteStartRef]);

  const cancelHold = useCallback(() => { holdCtlRef.current?.cancelActiveHold(); }, []);

  const applyDragStartAnim = useCallback(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = markerRef.current?.getElement();
    const inner = el?.querySelector<HTMLElement>(".plan-wp-mission-inner");
    if (!inner) return;
    inner.classList.remove("dd-wp-drag-settle");
    inner.classList.add("dd-wp-dragging");
  }, []);

  const applyDragEndAnim = useCallback(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = markerRef.current?.getElement();
    const inner = el?.querySelector<HTMLElement>(".plan-wp-mission-inner");
    if (!inner) return;
    inner.classList.remove("dd-wp-dragging");
    inner.classList.add("dd-wp-drag-settle");
    inner.addEventListener("animationend", () => inner.classList.remove("dd-wp-drag-settle"), { once: true });
  }, []);

  useLayoutEffect(() => {
    shouldIgnoreLongPressRef.current = showMenu;
  }, [showMenu]);

  useEffect(() => {
    if (!holdDeleteEnabled || showMenu) return undefined;

    let cancelled = false;
    let raf = 0;
    let attempts = 0;
    let ctl: ReturnType<typeof attachHoldStillLongPressToElement> | null = null;

    const tryAttach = () => {
      if (cancelled) return;
      const el = markerRef.current?.getElement();
      if (!el) {
        attempts += 1;
        if (attempts < 20) raf = requestAnimationFrame(tryAttach);
        return;
      }
      ctl = attachHoldStillLongPressToElement(el, {
        shouldIgnore: () => shouldIgnoreLongPressRef.current,
        slopPx: MAP_LONG_PRESS_MARKER_TOUCH_SLOP_PX,
        onStart: (coords) => { pressCoordRef.current = coords; },
        onFire: () => {
          openedViaHoldRef.current = true;
          haptic.heavy();
          setShowMenu(true);
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
  }, [holdDeleteEnabled, waypoint.lat, waypoint.lng, showMenu]);

  const menuItems = useMemo<RadialMenuItem[]>(() => {
    const items: RadialMenuItem[] = [
      {
        id: "route-start",
        icon: Navigation,
        label: "Início da rota",
        colorClass: "text-[#3ecf8e]",
      },
    ];
    if (waypointCount > 1) {
      items.push({
        id: "delete",
        icon: Trash2,
        label: "Deletar waypoint",
        colorClass: "text-red-400",
      });
    }
    return items;
  }, [waypointCount]);

  const handleMenuSelect = useCallback(
    (id: string) => {
      if (id === "delete") performDelete();
      else if (id === "route-start") performSetRouteStart();
      setShowMenu(false);
      openedViaHoldRef.current = false;
    },
    [performDelete, performSetRouteStart],
  );

  const handleMenuDismiss = useCallback(() => {
    setShowMenu(false);
    openedViaHoldRef.current = false;
  }, []);

  return (
    <>
      <Marker
        ref={markerRef}
        position={[waypoint.lat, waypoint.lng]}
        icon={icon}
        draggable={draggable && !showMenu}
        zIndexOffset={zIndexOffset}
        eventHandlers={{
          click: (e) => {
            L.DomEvent.stopPropagation(e);
            setSelectedWaypoint(waypoint.id);
          },
          dragstart: () => {
            cancelHold();
            applyDragStartAnim();
          },
          dragend: (e) => {
            applyDragEndAnim();
            onDragEndForId(waypoint.id)(e);
          },
        }}
      >
        {!showMenu ? (
          <Tooltip direction="top" offset={[0, -8]}>
            {tooltip}
          </Tooltip>
        ) : null}
      </Marker>

      {showMenu ? (
        <RadialContextMenu
          position={pressCoordRef.current}
          items={menuItems}
          onSelect={handleMenuSelect}
          onDismiss={handleMenuDismiss}
          openedViaHold={openedViaHoldRef.current}
        />
      ) : null}
    </>
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
      state.updateWaypoint(id, patch, true);

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
  const params = useFlightStore((s) => s.params);
  const routeStartRef = useFlightStore((s) => s.routeStartRef);
  const calibrationMapPreviewActive = useFlightStore(
    (s) => s.calibrationMapPreviewActive,
  );
  const plannerInteractionMode = useFlightStore((s) => s.plannerInteractionMode);
  const movePolygonVertex = useFlightStore((s) => s.movePolygonVertex);
  const deletePolygonVertex = useFlightStore((s) => s.deletePolygonVertex);
  const insertPolygonVertex = useFlightStore((s) => s.insertPolygonVertex);

  // ── Versão de pulso do polígono (incrementa ao mover vértice) ──
  const [polygonPulseVersion, setPolygonPulseVersion] = useState(0);
  const handleVertexMove = useCallback((i: number, ll: [number, number]) => {
    movePolygonVertex(i, ll);
    setPolygonPulseVersion((v) => v + 1);
  }, [movePolygonVertex]);

  const isDrawMode = plannerInteractionMode === "draw";
  const crosshairEnabled = readUserPreferencesFromStorage().crosshairDrawMode;
  const map = useMap();

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

  const calibrationStripLinePaths = useMemo(() => {
    if (!calibrationMission) return [] as { id: string; positions: [number, number][] }[];
    return calibrationMission.strips.map((strip) => ({
      id: strip.id,
      positions: strip.coordinates.map(
        ([lon, lat]) => [lat, lon] as [number, number],
      ),
    }));
  }, [calibrationMission]);

  const waypointIdSig = useMemo(
    () => waypoints.map((w) => w.id).join("\u001f"),
    [waypoints],
  );

  const routeLinePositions = useMemo(
    () => waypoints.map((w) => [w.lat, w.lng] as [number, number]),
    [waypoints],
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

  /** Versão de geometria do footprint de câmera; muda ao alterar altitude/params sem trocar waypoint selecionado. */
  const footprintVersion = useMemo((): string | null => {
    if (!waypointFovFootprintLatLng || waypointFovFootprintLatLng.length < 3) return null;
    const lats = waypointFovFootprintLatLng.map((p) => p[0]);
    const lngs = waypointFovFootprintLatLng.map((p) => p[1]);
    return `${Math.min(...lats).toFixed(5)},${Math.max(...lats).toFixed(5)},${Math.min(...lngs).toFixed(5)},${Math.max(...lngs).toFixed(5)}`;
  }, [waypointFovFootprintLatLng]);

  return (
    <>
      <MapDrawInteraction />
      <MapClearWaypointSelection />
      <MapPlannerCursor />
      <MapGestureLock />
      <MapUndoRedoGesture />
      <MapUndoKeyboard />
      <MapLongPressWaypoint />
      <FreehandDrawOverlay visible={isDrawMode} />
      <CrosshairOverlay
        visible={isDrawMode && crosshairEnabled}
        onAddVertex={handleCrosshairAddVertex}
      />
      <PolygonEditHandles
        polygon={polygon}
        editable={!isDrawMode && polygon !== null}
        onVertexMove={handleVertexMove}
        onVertexDelete={(i) => { haptic.medium(); deletePolygonVertex(i); }}
        onMidpointInsert={(after, ll) => { haptic.light(); insertPolygonVertex(after, ll); }}
      />
      <FlightPlannerMapDraftLayer />
      <FlightPlannerMapMissionPolygon
        pulseVersion={polygonPulseVersion}
        muteFullMission={muteFullMission}
      />
      <FlightPlannerMapMissionStrips muteFullMission={muteFullMission} />
      {waypoints.length > 1 ? (
        <RoutePolylineAnimated
          waypointsCount={waypoints.length}
          waypointIdSig={waypointIdSig}
          positions={routeLinePositions}
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
      {waypointFovFootprintLatLng && waypointFovFootprintLatLng.length >= 3 && selectedWaypointId ? (
        <MappingPolygonAnimated
          key={selectedWaypointId}
          enableEnter
          geometryVersion={footprintVersion}
          positions={waypointFovFootprintLatLng}
          pathOptions={{
            className: "dd-map-fov-footprint",
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
          {calibrationStripLinePaths.map((row) => (
            <Polyline
              key={`cal-strip-${row.id}`}
              positions={row.positions}
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

/** Módulo 6: Long press no mapa em modo navigate abre menu radial contextual. */
function MapLongPressWaypoint() {
  const mode = useFlightStore((s) => s.plannerInteractionMode);
  const waypoints = useFlightStore((s) => s.waypoints);
  const addManualWaypoint = useFlightStore((s) => s.addManualWaypoint);
  const setRouteStartRef = useFlightStore((s) => s.setRouteStartRef);
  const setPoi = useFlightStore((s) => s.setPoi);
  const map = useMap();
  const mapHoldCancelRef = useRef<(() => void) | null>(null);

  type MenuState = {
    position: { x: number; y: number };
    latlng: { lat: number; lng: number };
    openedViaHold: boolean;
  };
  const [menuState, setMenuState] = useState<MenuState | null>(null);

  useEffect(
    () => () => {
      mapHoldCancelRef.current?.();
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
      const latlng = { lat: e.latlng.lat, lng: e.latlng.lng };

      const openMenu = (coords: { x: number; y: number }) => {
        mapHoldCancelRef.current = null;
        haptic.heavy();
        setMenuState({ position: coords, latlng, openedViaHold: true });
      };

      if (!pt) {
        let cancel: () => void;
        const finish = () => { map.off("mouseup", cancel); map.off("mousemove", cancel); };
        const timer = window.setTimeout(() => {
          finish();
          const r = map.getContainer().getBoundingClientRect();
          openMenu({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
        }, MAP_LONG_PRESS_MS);
        cancel = () => { window.clearTimeout(timer); finish(); mapHoldCancelRef.current = null; };
        mapHoldCancelRef.current = cancel;
        map.on("mouseup", cancel);
        map.on("mousemove", cancel);
        return;
      }
      mapHoldCancelRef.current = subscribeHoldStillLongPress(pt, () =>
        openMenu({ x: pt.clientX, y: pt.clientY }),
      );
    },
  });

  if (!menuState) return null;

  const menuItems: RadialMenuItem[] = [
    {
      id: "add-waypoint",
      icon: MapPin,
      label: "Adicionar waypoint",
      colorClass: "text-[#3ecf8e]",
    },
  ];
  if (waypoints.length > 0) {
    menuItems.push(
      {
        id: "set-poi",
        icon: Crosshair,
        label: "Definir POI",
        colorClass: "text-cyan-400",
      },
      {
        id: "set-route-start",
        icon: Navigation,
        label: "Início da rota",
        colorClass: "text-blue-400",
      },
    );
  }

  const handleSelect = (id: string) => {
    const { latlng } = menuState;
    const st = useFlightStore.getState();
    if (id === "add-waypoint") {
      const alt =
        waypoints.length > 0
          ? waypoints.reduce((sum, w) => sum + w.altitude, 0) / waypoints.length
          : st.params.altitudeM;
      haptic.medium();
      addManualWaypoint([latlng.lat, latlng.lng], alt);
    } else if (id === "set-poi") {
      haptic.light();
      setPoi(newPointOfInterest(latlng.lat, latlng.lng, st.waypoints, st.params.altitudeM));
      toast("POI definido", { duration: 2000 });
    } else if (id === "set-route-start") {
      setRouteStartRef(latlng);
      haptic.light();
      toast("Ponto de início da rota definido", { duration: 2500 });
    }
    setMenuState(null);
  };

  return (
    <RadialContextMenu
      position={menuState.position}
      items={menuItems}
      onSelect={handleSelect}
      onDismiss={() => setMenuState(null)}
      openedViaHold={menuState.openedViaHold}
    />
  );
}

/** Undo/redo por gesto de dois dedos (swipe esquerda/direita) no mapa. */
function MapUndoRedoGesture() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    let startX: number | null = null;
    let startY: number | null = null;
    let startTime = 0;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length < 2) return;
      startX = (e.touches[0]!.clientX + e.touches[1]!.clientX) / 2;
      startY = (e.touches[0]!.clientY + e.touches[1]!.clientY) / 2;
      startTime = Date.now();
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (startX === null || startY === null) return;
      if (Date.now() - startTime > 600) { startX = null; return; }

      const t0 = e.changedTouches[0];
      if (!t0) { startX = null; return; }
      const endX = t0.clientX;
      const endY = t0.clientY;
      const dx = endX - startX;
      const dy = Math.abs(endY - startY);
      startX = null;
      startY = null;

      if (Math.abs(dx) < 45 || dy > 35) return;

      const st = useFlightStore.getState();
      if (dx < 0) {
        const entry = st.undo();
        if (entry) {
          haptic.light();
          toast(`↩ ${entry.label} desfeito`, { duration: 1500 });
        }
      } else {
        const entry = st.redo();
        if (entry) {
          haptic.light();
          toast(`↪ ${entry.label} refeito`, { duration: 1500 });
        }
      }
    };

    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchend", onTouchEnd);
    return () => {
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchend", onTouchEnd);
    };
  }, [map]);

  return null;
}

/** Atalhos de teclado Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y para undo/redo (desktop). */
function MapUndoKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      const tag = (document.activeElement as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        const entry = useFlightStore.getState().undo();
        if (entry) toast(`↩ ${entry.label} desfeito`, { duration: 1500 });
      } else if (e.key === "y" || (e.key === "z" && e.shiftKey)) {
        e.preventDefault();
        const entry = useFlightStore.getState().redo();
        if (entry) toast(`↪ ${entry.label} refeito`, { duration: 1500 });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
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
