import turfBbox from "@turf/bbox";
import { featureCollection, lineString, point } from "@turf/helpers";
import type { Feature, Polygon } from "geojson";
import type { MapBounds } from "@/features/results/stores/useResultsViewStore";
import type { PointOfInterest } from "@/features/flight-planner/types/poi";
import type { Waypoint } from "@/features/flight-planner/types/waypoint";

/**
 * Bounds no formato Leaflet `[[south, west], [north, east]]` para encaixar
 * polígono da missão, rascunho, rota e POI no mapa.
 */
export function computeFlightPlanMapBounds(args: {
  polygon: Feature<Polygon> | null;
  draftPoints: [number, number][];
  waypoints: Pick<Waypoint, "lat" | "lng">[];
  poi: PointOfInterest | null;
}): MapBounds | null {
  const { polygon, draftPoints, waypoints, poi } = args;
  const feats: Feature[] = [];
  if (polygon) feats.push(polygon);
  if (draftPoints.length >= 2) {
    const coords = draftPoints.map(
      ([lat, lng]) => [lng, lat] as [number, number],
    );
    feats.push(lineString(coords));
  } else if (draftPoints.length === 1) {
    const [lat, lng] = draftPoints[0]!;
    feats.push(point([lng, lat]));
  }
  if (waypoints.length >= 2) {
    feats.push(
      lineString(waypoints.map((w) => [w.lng, w.lat] as [number, number])),
    );
  } else if (waypoints.length === 1) {
    const w = waypoints[0]!;
    feats.push(point([w.lng, w.lat]));
  }
  if (poi) feats.push(point([poi.lng, poi.lat]));
  if (feats.length === 0) return null;
  const b = turfBbox(featureCollection(feats));
  if (!Number.isFinite(b[0])) return null;
  return [
    [b[1]!, b[0]!],
    [b[3]!, b[2]!],
  ];
}
