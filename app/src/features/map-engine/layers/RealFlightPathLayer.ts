import { PathLayer } from "@deck.gl/layers";
import type { Feature, FeatureCollection, LineString } from "geojson";

function isLineStringFeature(
  f: Feature,
): f is Feature<LineString, Record<string, unknown>> {
  return f.geometry?.type === "LineString";
}

/** Extrai coordenadas [lng, lat, z] do LineString da resposta do backend. */
export function lineStringCoordinates3d(
  fc: FeatureCollection,
): [number, number, number][] {
  const line = fc.features.find(isLineStringFeature);
  const coords = line?.geometry?.coordinates;
  if (!coords?.length) return [];
  return coords.map((c) => {
    const z =
      typeof c[2] === "number" && !Number.isNaN(c[2]) ? c[2] : 0;
    return [c[0], c[1], z] as [number, number, number];
  });
}

/** Rota reconstruida a partir das fotos (ciano vs amarelo do plano). */
export function createRealFlightPathLayer(
  path: [number, number, number][],
): PathLayer | null {
  if (path.length < 2) return null;
  const pathHash = `${path.length},${String(path[0]?.[0])},${String(path[path.length - 1]?.[0])}`;
  return new PathLayer({
    id: "real-flight-telemetry",
    data: [{ path }],
    getPath: (d: { path: [number, number, number][] }) => d.path,
    getColor: [0, 255, 255, 220],
    getWidth: 3,
    widthUnits: "pixels",
    capRounded: true,
    jointRounded: true,
    updateTriggers: {
      getPath: pathHash,
    },
  });
}
