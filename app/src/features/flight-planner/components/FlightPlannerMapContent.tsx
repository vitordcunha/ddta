import { useCallback, useEffect, useMemo, useRef } from "react";
import * as turf from "@turf/turf";
import type * as GeoJSON from "geojson";
import L, { type DivIcon } from "leaflet";
import {
  CircleMarker,
  Marker,
  Polygon,
  Polyline,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { useMapEngine } from "@/features/map-engine/useMapEngine";
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
    html: `<div style="width:${dPx}px;height:${dPx}px;border-radius:50%;background:${fill};border:${strokeW}px solid ${stroke};box-sizing:border-box;margin:${pad}px"/>`,
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

function PlanMissionWaypointMarkers({
  waypoints,
  muteFullMission,
}: {
  waypoints: Waypoint[];
  muteFullMission: boolean;
}) {
  const setSelectedWaypoint = useFlightStore((s) => s.setSelectedWaypoint);
  const { mapboxToken } = useMapEngine();
  const dragTerrainSerial = useRef(0);

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

      const serial = ++dragTerrainSerial.current;
      const svc = createMapboxElevationService(mapboxToken);
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
    },
    [mapboxToken],
  );

  const draggable = !muteFullMission;

  if (waypoints.length === 0) return null;

  if (waypoints.length === 1) {
    const w = waypoints[0]!;
    const icon = muteFullMission ? WP_MISSION_ICON.singleMuted : WP_MISSION_ICON.single;
    return (
      <Marker
        key={`wp-mission-${w.id}`}
        position={[w.lat, w.lng]}
        icon={icon}
        draggable={draggable}
        zIndexOffset={600}
        eventHandlers={{
          click: () => setSelectedWaypoint(w.id),
          dragend: onDragEnd(w.id),
        }}
      >
        <Tooltip direction="top" offset={[0, -8]}>
          <span className="font-medium">Inicio e fim da rota</span>
          <br />
          {formatWpLine(w)}
        </Tooltip>
      </Marker>
    );
  }

  const first = waypoints[0]!;
  const last = waypoints[waypoints.length - 1]!;

  return (
    <>
      {waypoints.slice(1, -1).map((waypoint) => {
        const icon = muteFullMission ? WP_MISSION_ICON.midMuted : WP_MISSION_ICON.mid;
        return (
          <Marker
            key={`wp-mission-${waypoint.id}`}
            position={[waypoint.lat, waypoint.lng]}
            icon={icon}
            draggable={draggable}
            zIndexOffset={400}
            eventHandlers={{
              click: () => setSelectedWaypoint(waypoint.id),
              dragend: onDragEnd(waypoint.id),
            }}
          >
            <Tooltip>{formatWpLine(waypoint)}</Tooltip>
          </Marker>
        );
      })}
      <Marker
        key={`wp-mission-start-${first.id}`}
        position={[first.lat, first.lng]}
        icon={muteFullMission ? WP_MISSION_ICON.startMuted : WP_MISSION_ICON.start}
        draggable={draggable}
        zIndexOffset={600}
        eventHandlers={{
          click: () => setSelectedWaypoint(first.id),
          dragend: onDragEnd(first.id),
        }}
      >
        <Tooltip direction="top" offset={[0, -8]}>
          <span className="font-medium">Inicio da rota</span>
          <br />
          {formatWpLine(first)}
        </Tooltip>
      </Marker>
      <Marker
        key={`wp-mission-end-${last.id}`}
        position={[last.lat, last.lng]}
        icon={muteFullMission ? WP_MISSION_ICON.endMuted : WP_MISSION_ICON.end}
        draggable={draggable}
        zIndexOffset={500}
        eventHandlers={{
          click: () => setSelectedWaypoint(last.id),
          dragend: onDragEnd(last.id),
        }}
      >
        <Tooltip direction="top" offset={[0, -8]}>
          <span className="font-medium">Fim da rota</span>
          <br />
          {formatWpLine(last)}
        </Tooltip>
      </Marker>
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
      turf.polygon([[...lonLatRing, lonLatRing[0]!]]) as GeoJSON.Feature,
    ];
    for (const r of rings) {
      const closed = r.ringLatLng.map(([lat, lon]) => [lon, lat] as [number, number]);
      if (closed.length >= 3) {
        feats.push(turf.polygon([[...closed, closed[0]!]]) as GeoJSON.Feature);
      }
    }
    if (routeLatLng.length >= 2) {
      feats.push(turf.lineString(routeLatLng.map(([lat, lon]) => [lon, lat])) as GeoJSON.Feature);
    }
    const b = turf.bbox(turf.featureCollection(feats));
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
  const waypoints = useFlightStore((s) => s.waypoints);
  const strips = useFlightStore((s) => s.strips);
  const draftPoints = useFlightStore((s) => s.draftPoints);
  const params = useFlightStore((s) => s.params);
  const routeStartRef = useFlightStore((s) => s.routeStartRef);
  const calibrationMapPreviewActive = useFlightStore(
    (s) => s.calibrationMapPreviewActive,
  );

  const calibrationMission = useMemo(() => {
    if (!calibrationMapPreviewActive || !polygon) return null;
    return buildCalibrationMission(polygon, params, routeStartRef);
  }, [calibrationMapPreviewActive, polygon, params, routeStartRef]);

  const calibrationCenterLat = useMemo(() => {
    if (!calibrationMission) return 0;
    return turf.centerOfMass(calibrationMission.calibrationPolygon).geometry
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

  return (
    <>
      <MapDrawInteraction />
      <MapPlannerCursor />
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
          setPolygon(closed);
          setDraftPoints([]);
        }
        return;
      }
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
