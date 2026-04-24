import * as turf from "@turf/turf"
import type { Feature, Polygon } from "geojson"

/** Draft points are [lat, lon] in Leaflet order */
export const FIRST_VERTEX_CLOSE_SNAP_M = 22

/**
 * Clica perto o suficiente do primeiro vertice: fecha so com
 * mais de 4 pontos (>= 5 vertice), i.e. poligono com pelo menos 5 cantos
 * antes de fechar.
 */
export function isClickNearFirstVertex(
  clickLatLng: [number, number],
  draftPoints: [number, number][],
  minPointsForFirstVertexClose = 5,
  maxDistanceM = FIRST_VERTEX_CLOSE_SNAP_M,
): boolean {
  if (draftPoints.length < minPointsForFirstVertexClose) return false
  const first = draftPoints[0]!
  const from = turf.point([first[1], first[0]])
  const to = turf.point([clickLatLng[1], clickLatLng[0]])
  return turf.distance(from, to, { units: "meters" }) < maxDistanceM
}

export function closeDraftToPolygon(
  draftPoints: [number, number][],
): Feature<Polygon> | null {
  if (draftPoints.length < 3) return null
  const ring = draftPoints.map(
    ([lat, lon]) => [lon, lat] as [number, number],
  )
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [[...ring, ring[0]!]],
    },
  }
}
