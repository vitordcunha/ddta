import type { CompletedProjectStats } from '@/features/results/types'

export const processingPresets = {
  fast: {
    label: 'Fast',
    eta: '25-35 min',
    description: 'Entrega rapida com qualidade reduzida para validacao em campo.',
    expectedGsd: '4,2 cm/px',
  },
  standard: {
    label: 'Standard',
    eta: '45-70 min',
    description: 'Balanco entre qualidade e velocidade para entregas operacionais.',
    expectedGsd: '2,8 cm/px',
  },
  ultra: {
    label: 'Ultra',
    eta: '90-130 min',
    description: 'Maxima qualidade para analise tecnica e relatorios finais.',
    expectedGsd: '1,9 cm/px',
  },
} as const

export const completedProjectStats: CompletedProjectStats = {
  gsdCmPx: 2.4,
  areaHa: 4.2,
  imageCount: 847,
  pointCount: 12400000,
  orthophotoResolutionCmPx: 2.6,
  processingTimeMinutes: 98,
}

export const mockResultAssets = {
  orthophoto: { available: true, format: 'GeoTIFF COG', size: '1.4 GB' },
  dsm: { available: true, format: 'GeoTIFF', size: '920 MB' },
  dtm: { available: true, format: 'GeoTIFF', size: '801 MB' },
  pointCloud: { available: true, format: '.LAS', size: '2.3 GB' },
  contours: { available: true, format: '.SHP / .GeoJSON', size: '74 MB' },
  report: { available: true, format: '.PDF', size: '8.1 MB' },
}

export const sampleContours: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { elevation: 1018 },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-47.8842, -15.7931],
          [-47.8828, -15.7929],
          [-47.8817, -15.7933],
          [-47.8806, -15.794],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { elevation: 1020 },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-47.8839, -15.7942],
          [-47.8825, -15.7941],
          [-47.8812, -15.7945],
          [-47.8802, -15.7951],
        ],
      },
    },
  ],
}
