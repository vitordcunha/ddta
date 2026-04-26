import type { DeviceTier } from '@/features/map-engine/utils/detectDeviceTier'

/**
 * O.10: limite de pontos da nuvem esparsa por tier.
 * 2D (Leaflet) usa teto 50k; 3D / PointCloud com deck usa 15k em dispositivos low.
 */
export function getSparseCloudMaxPoints(
  deviceTier: DeviceTier,
  use3DOrDeckPointCloud: boolean,
): number {
  if (use3DOrDeckPointCloud && deviceTier === 'low') {
    return 15_000
  }
  return 50_000
}
