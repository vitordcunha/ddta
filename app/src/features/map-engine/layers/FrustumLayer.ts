import { PolygonLayer } from '@deck.gl/layers'
import type { Layer } from '@deck.gl/core'
import type { FrustumGeometry } from '@/features/flight-planner/utils/frustumCalculator'

type FrustumLayerOptions = {
  /** Em vista 2D (mapa plano) omitir faces 3D; só o polígono no solo. */
  includeSides?: boolean
}

/** Cone de câmera (Fase 8): footprint no terreno + faces laterais semi-transparentes. */
export function createFrustumLayers(
  geometry: FrustumGeometry | null,
  options?: FrustumLayerOptions,
): Layer[] {
  if (!geometry) return []
  const includeSides = options?.includeSides !== false

  const footprint = new PolygonLayer({
    id: 'frustum-footprint',
    data: [{ contour: geometry.footprintPolygon }],
    getPolygon: (d: { contour: [number, number][] }) => d.contour,
    getFillColor: [255, 210, 0, 72],
    stroked: true,
    getLineColor: [255, 220, 80, 140],
    getLineWidth: 1,
    lineWidthUnits: 'pixels',
    pickable: false,
  })

  if (!includeSides) return [footprint]

  const sides = new PolygonLayer({
    id: 'frustum-sides',
    data: geometry.sidePolygons.map((ring, i) => ({ ring, i })),
    getPolygon: (d: { ring: [number, number, number][] }) => d.ring,
    getFillColor: [255, 255, 255, 28],
    stroked: true,
    getLineColor: [255, 255, 255, 90],
    getLineWidth: 1,
    lineWidthUnits: 'pixels',
    pickable: false,
  })

  return [footprint, sides]
}
