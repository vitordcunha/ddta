import { PolygonLayer } from '@deck.gl/layers'

/**
 * Cone de câmera (Fase 8). Stub: sem geometria até haver dados de frustum.
 */
export function createFrustumLayer(): PolygonLayer {
  return new PolygonLayer({
    id: 'frustum-stub',
    data: [] as { contour: [number, number][] }[],
    getPolygon: (d: { contour: [number, number][] }) => d.contour,
    pickable: false,
  })
}
