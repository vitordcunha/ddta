import { useEffect, useMemo } from "react";
import {
  CircleMarker,
  Polygon,
  Polyline,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { useFlightStore } from "@/features/flight-planner/stores/useFlightStore";
import type { Waypoint } from "@/features/flight-planner/types";
import {
  closeDraftToPolygon,
  isClickNearFirstVertex,
} from "@/features/flight-planner/utils/polygonDraft";

function formatWpLine(w: Waypoint) {
  return `${w.lat.toFixed(6)}, ${w.lon.toFixed(6)} | ${w.altitudeM}m`;
}

export function FlightPlannerMapContent() {
  const polygon = useFlightStore((s) => s.polygon);
  const waypoints = useFlightStore((s) => s.waypoints);
  const strips = useFlightStore((s) => s.strips);
  const draftPoints = useFlightStore((s) => s.draftPoints);

  const polygonCoords = useMemo(
    () =>
      polygon?.geometry.coordinates[0].map(
        ([lon, lat]) => [lat, lon] as [number, number],
      ) ?? [],
    [polygon],
  );

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
          pathOptions={{
            color: "#3ecf8e",
            fillOpacity: 0.18,
            weight: 2,
          }}
        />
      )}
      {strips.map((strip) => (
        <Polyline
          key={strip.id}
          positions={strip.coordinates.map(([lon, lat]) => [lat, lon])}
          pathOptions={{ color: "#00c573", weight: 2, opacity: 0.75 }}
        />
      ))}
      {waypoints.length > 1 ? (
        <Polyline
          positions={waypoints.map((w) => [w.lat, w.lon])}
          pathOptions={{
            color: "#fbbf24",
            weight: 3,
            opacity: 0.92,
            lineCap: "round",
            lineJoin: "round",
          }}
        />
      ) : null}
      {waypoints.length === 0 ? null : waypoints.length === 1 ? (
        <CircleMarker
          key={`wp-single-${waypoints[0]!.id}`}
          center={[waypoints[0]!.lat, waypoints[0]!.lon]}
          radius={9}
          pathOptions={{
            color: "#14532d",
            weight: 2.5,
            fillColor: "#3ecf8e",
            fillOpacity: 1,
          }}
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
              radius={3}
              pathOptions={{
                color: "#fafafa",
                weight: 1,
                fillColor: "#e5e5e5",
                fillOpacity: 0.95,
              }}
            >
              <Tooltip>{formatWpLine(waypoint)}</Tooltip>
            </CircleMarker>
          ))}
          <CircleMarker
            key={`wp-start-${waypoints[0]!.id}`}
            center={[waypoints[0]!.lat, waypoints[0]!.lon]}
            radius={9}
            pathOptions={{
              color: "#14532d",
              weight: 2.5,
              fillColor: "#3ecf8e",
              fillOpacity: 1,
            }}
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
            radius={9}
            pathOptions={{
              color: "#7f1d1d",
              weight: 2.5,
              fillColor: "#f87171",
              fillOpacity: 1,
            }}
          >
            <Tooltip direction="top" offset={[0, -8]}>
              <span className="font-medium">Fim da rota</span>
              <br />
              {formatWpLine(waypoints[waypoints.length - 1]!)}
            </Tooltip>
          </CircleMarker>
        </>
      )}
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
