import turfArea from "@turf/area";
import centerOfMass from "@turf/center-of-mass";
import intersect from "@turf/intersect";
import { featureCollection, polygon } from "@turf/helpers";
import type { Feature, MultiPolygon, Polygon, Position } from "geojson";
import type { RouteStartRef } from "@/features/flight-planner/stores/useFlightStore";
import { getDroneSpec } from "@/features/flight-planner/utils/droneSpecs";
import type {
  FlightParams,
  FlightStats,
  Strip,
  Waypoint,
} from "@/features/flight-planner/types";
import {
  calculateFootprint,
  calculateGsd,
  calculateSpacings,
  calculateStats,
  generateFlightGrid,
  generateWaypoints,
  optimizeFlightPlanStart,
} from "@/features/flight-planner/utils/waypointCalculator";

const MIN_CALIB_WAYPOINTS = 5;
const TARGET_MAX_DURATION_MIN = 3.2;
const MIN_SIDE_M = 55;
const MAX_SIDE_M = 420;

/** Quadrado alinhado aos eixos (lon/lat), centrado em graus, lado em metros. */
export function axisAlignedSquareMeters(
  centerLon: number,
  centerLat: number,
  sideM: number,
): Feature<Polygon> {
  const half = sideM / 2;
  const dy = half / 111320;
  const cosLat = Math.cos((centerLat * Math.PI) / 180);
  const dx = half / (111320 * Math.max(Math.abs(cosLat), 0.01));
  const ring: Position[] = [
    [centerLon - dx, centerLat - dy],
    [centerLon + dx, centerLat - dy],
    [centerLon + dx, centerLat + dy],
    [centerLon - dx, centerLat + dy],
    [centerLon - dx, centerLat - dy],
  ];
  return polygon([ring]);
}

function largestPolygonFromIntersect(
  f: Feature<Polygon | MultiPolygon> | null,
): Feature<Polygon> | null {
  if (!f) return null;
  if (f.geometry.type === "Polygon") return f as Feature<Polygon>;
  const coords = f.geometry.coordinates;
  let best: Feature<Polygon> | null = null;
  let bestArea = 0;
  for (const polyCoords of coords) {
    const p = polygon(polyCoords);
    const a = turfArea(p);
    if (a > bestArea) {
      bestArea = a;
      best = p;
    }
  }
  return best;
}

function intersectCalibrationFootprint(
  missionPolygon: Feature<Polygon>,
  centerLon: number,
  centerLat: number,
  sideM: number,
): Feature<Polygon> | null {
  const square = axisAlignedSquareMeters(centerLon, centerLat, sideM);
  const inter = intersect(featureCollection([missionPolygon, square]));
  return largestPolygonFromIntersect(inter);
}

function computeRouteForPolygon(
  calPoly: Feature<Polygon>,
  params: FlightParams,
  routeStartRef: RouteStartRef | null,
): { strips: Strip[]; waypoints: Waypoint[]; stats: FlightStats } {
  const specs = getDroneSpec(params.droneModel);
  const gsdM = calculateGsd(params.altitudeM, specs);
  const footprint = calculateFootprint(gsdM, specs);
  const spacings = calculateSpacings(
    footprint,
    params.forwardOverlap,
    params.sideOverlap,
  );

  const { strips, waypoints } =
    routeStartRef != null
      ? optimizeFlightPlanStart(
          calPoly,
          spacings,
          params.rotationDeg,
          params.altitudeM,
          routeStartRef,
        )
      : (() => {
          const s = generateFlightGrid(calPoly, spacings, params.rotationDeg);
          return {
            strips: s,
            waypoints: generateWaypoints(s, params.altitudeM),
          };
        })();

  const stats = calculateStats(waypoints, calPoly, params, strips, specs);
  return { strips, waypoints, stats };
}

/**
 * Recorta a área central (~10% da área ou caixa mínima 80 m) para um voo curto de calibração,
 * garantindo overlap útil (≥5 waypoints) e preferindo duração &lt; ~3 min.
 */
export function buildCalibrationPolygon(
  polygon: Feature<Polygon>,
  params: FlightParams,
  routeStartRef?: RouteStartRef | null,
): Feature<Polygon> | null {
  const mission = buildCalibrationMission(
    polygon,
    params,
    routeStartRef ?? null,
  );
  return mission?.calibrationPolygon ?? null;
}

export type CalibrationMission = {
  calibrationPolygon: Feature<Polygon>;
  waypoints: Waypoint[];
  strips: Strip[];
  stats: FlightStats;
};

export function buildCalibrationMission(
  polygon: Feature<Polygon>,
  params: FlightParams,
  routeStartRef: RouteStartRef | null,
): CalibrationMission | null {
  const center = centerOfMass(polygon).geometry.coordinates;
  const centerLon = center[0]!;
  const centerLat = center[1]!;
  const areaM2 = Math.max(turfArea(polygon), 1);

  let sideM = Math.sqrt(areaM2 * 0.11);
  sideM = Math.min(Math.max(sideM, 80), 140);

  let best: CalibrationMission | null = null;

  for (let i = 0; i < 28; i += 1) {
    const calPoly = intersectCalibrationFootprint(
      polygon,
      centerLon,
      centerLat,
      sideM,
    );
    if (!calPoly || turfArea(calPoly) < 50) {
      sideM = Math.min(sideM * 1.18, MAX_SIDE_M);
      continue;
    }

    const { strips, waypoints, stats } = computeRouteForPolygon(
      calPoly,
      params,
      routeStartRef,
    );
    const tooFew = waypoints.length < MIN_CALIB_WAYPOINTS;
    const tooLong = stats.estimatedTimeMin > TARGET_MAX_DURATION_MIN;

    if (!tooFew && !tooLong) {
      return { calibrationPolygon: calPoly, waypoints, strips, stats };
    }

    best = { calibrationPolygon: calPoly, waypoints, strips, stats };

    if (tooFew) {
      sideM = Math.min(sideM * 1.14, MAX_SIDE_M);
    } else if (tooLong) {
      sideM = Math.max(sideM * 0.86, MIN_SIDE_M);
    }
  }

  return best;
}

/** Estatísticas da missão de calibração (fotos / tempo) para exibir no modal. */
export function buildCalibrationStats(
  polygon: Feature<Polygon>,
  params: FlightParams,
  routeStartRef?: RouteStartRef | null,
): FlightStats | null {
  return (
    buildCalibrationMission(polygon, params, routeStartRef ?? null)?.stats ??
    null
  );
}
