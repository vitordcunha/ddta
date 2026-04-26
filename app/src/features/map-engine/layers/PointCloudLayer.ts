import { PointCloudLayer } from '@deck.gl/layers'

type PcDatum = { position: [number, number, number]; color: [number, number, number] }

/**
 * Nuvem esparsa dos resultados (SfM). Stub para Fase 5; ligar a dados GeoJSON/dense mais tarde.
 */
export function createResultPointCloudLayer(): PointCloudLayer {
  const invisible: PcDatum[] = [
    { position: [0, 0, -1e6], color: [0, 0, 0] },
  ]
  return new PointCloudLayer({
    id: 'results-point-cloud-stub',
    data: invisible,
    getPosition: (d: PcDatum) => d.position,
    getColor: () => [0, 0, 0, 0] as [number, number, number, number],
    pointSize: 0,
    pickable: false,
  })
}
