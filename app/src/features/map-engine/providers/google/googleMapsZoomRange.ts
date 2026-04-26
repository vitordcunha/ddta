/**
 * Conversão aproximada entre zoom Web Mercator (estilo MapEngine) e `range`
 * do Map3DElement (distância da câmera ao centro, em metros).
 */
const METERS_PER_PIXEL_AT_EQUATOR_Z0 = 156543.03392

export function metersPerPixelAtLatitude(zoom: number, latitudeDeg: number): number {
  const latRad = (latitudeDeg * Math.PI) / 180
  return (METERS_PER_PIXEL_AT_EQUATOR_Z0 * Math.cos(latRad)) / 2 ** zoom
}

export function zoomLevelToCameraRangeMeters(
  zoom: number,
  latitudeDeg: number,
  viewportHeightPx: number,
): number {
  const mpp = metersPerPixelAtLatitude(zoom, latitudeDeg)
  const range = mpp * Math.max(320, viewportHeightPx) * 0.72
  return Math.min(900_000, Math.max(60, range))
}

export function cameraRangeMetersToZoomLevel(
  rangeM: number,
  latitudeDeg: number,
  viewportHeightPx: number,
): number {
  if (rangeM <= 0) return 15
  const mpp = rangeM / (Math.max(320, viewportHeightPx) * 0.72)
  const latRad = (latitudeDeg * Math.PI) / 180
  const numerator = METERS_PER_PIXEL_AT_EQUATOR_Z0 * Math.cos(latRad)
  const z = Math.log2(numerator / mpp)
  if (!Number.isFinite(z)) return 15
  return Math.max(1, Math.min(22, z))
}
