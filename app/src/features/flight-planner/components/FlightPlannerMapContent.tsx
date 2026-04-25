import { useEffect, useMemo } from "react";
import * as turf from "@turf/turf";
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
import { useFlightStore } from "@/features/flight-planner/stores/useFlightStore";
import type { Waypoint } from "@/features/flight-planner/types";
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
  return `${w.lat.toFixed(6)}, ${w.lon.toFixed(6)} | ${w.altitudeM}m`;
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
    const feats: turf.helpers.Feature[] = [
      turf.polygon([[...lonLatRing, lonLatRing[0]!]]),
    ];
    for (const r of rings) {
      const closed = r.ringLatLng.map(([lat, lon]) => [lon, lat] as [number, number]);
      if (closed.length >= 3) {
        feats.push(turf.polygon([[...closed, closed[0]!]]));
      }
    }
    if (routeLatLng.length >= 2) {
      feats.push(
        turf.lineString(routeLatLng.map(([lat, lon]) => [lon, lat])),
      );
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
      (w) => [w.lat, w.lon] as [number, number],
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
          positions={waypoints.map((w) => [w.lat, w.lon])}
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
      {waypoints.length === 0 ? null : waypoints.length === 1 ? (
        <CircleMarker
          key={`wp-single-${waypoints[0]!.id}`}
          center={[waypoints[0]!.lat, waypoints[0]!.lon]}
          radius={muteFullMission ? 7 : 9}
          pathOptions={
            muteFullMission
              ? {
                  color: "#57534e",
                  weight: 2,
                  fillColor: "#a8a29e",
                  fillOpacity: 0.95,
                }
              : {
                  color: "#14532d",
                  weight: 2.5,
                  fillColor: "#3ecf8e",
                  fillOpacity: 1,
                }
          }
        >
          <Tooltip direction="top" offset={[0, -8]}>
            <span className="font-medium">Inicio e fim da rota</span>
            <br />
            {formatWpLine(waypoints[0]!)}
          </Tooltip>
        </CircleMarker>
      ) : (
        <>
          {waypoints.slice(1, -1).map((waypoint) => (
            <CircleMarker
              key={waypoint.id}
              center={[waypoint.lat, waypoint.lon]}
              radius={muteFullMission ? 2.5 : 3}
              pathOptions={
                muteFullMission
                  ? {
                      color: "#cbd5e1",
                      weight: 1,
                      fillColor: "#94a3b8",
                      fillOpacity: 0.75,
                    }
                  : {
                      color: "#fafafa",
                      weight: 1,
                      fillColor: "#e5e5e5",
                      fillOpacity: 0.95,
                    }
              }
            >
              <Tooltip>{formatWpLine(waypoint)}</Tooltip>
            </CircleMarker>
          ))}
          <CircleMarker
            key={`wp-start-${waypoints[0]!.id}`}
            center={[waypoints[0]!.lat, waypoints[0]!.lon]}
            radius={muteFullMission ? 7 : 9}
            pathOptions={
              muteFullMission
                ? {
                    color: "#57534e",
                    weight: 2,
                    fillColor: "#a8a29e",
                    fillOpacity: 0.95,
                  }
                : {
                    color: "#14532d",
                    weight: 2.5,
                    fillColor: "#3ecf8e",
                    fillOpacity: 1,
                  }
            }
          >
            <Tooltip direction="top" offset={[0, -8]}>
              <span className="font-medium">Inicio da rota</span>
              <br />
              {formatWpLine(waypoints[0]!)}
            </Tooltip>
          </CircleMarker>
          <CircleMarker
            key={`wp-end-${waypoints[waypoints.length - 1]!.id}`}
            center={[
              waypoints[waypoints.length - 1]!.lat,
              waypoints[waypoints.length - 1]!.lon,
            ]}
            radius={muteFullMission ? 7 : 9}
            pathOptions={
              muteFullMission
                ? {
                    color: "#44403c",
                    weight: 2,
                    fillColor: "#78716c",
                    fillOpacity: 0.95,
                  }
                : {
                    color: "#7f1d1d",
                    weight: 2.5,
                    fillColor: "#f87171",
                    fillOpacity: 1,
                  }
            }
          >
            <Tooltip direction="top" offset={[0, -8]}>
              <span className="font-medium">Fim da rota</span>
              <br />
              {formatWpLine(waypoints[waypoints.length - 1]!)}
            </Tooltip>
          </CircleMarker>
        </>
      )}

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
                    position={[w.lat, w.lon]}
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
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    el.style.cursor = mode === "draw" ? "crosshair" : "";
    return () => {
      el.style.cursor = "";
    };
  }, [map, mode]);
  return null;
}
