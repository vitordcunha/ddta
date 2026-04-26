/**
 * Parâmetros de câmera até a Fase 9 (modelos de drone).
 * Fallback: DJI Mavic 3 — FOV horizontal ~84°, vertical ~70°.
 */
export const DEFAULT_CAMERA_FOV_HORIZONTAL_DEG = 84
export const DEFAULT_CAMERA_FOV_VERTICAL_DEG = 70

export type DroneCameraParams = {
  fovHorizontalDeg: number
  fovVerticalDeg: number
}

export function defaultDroneCameraParams(): DroneCameraParams {
  return {
    fovHorizontalDeg: DEFAULT_CAMERA_FOV_HORIZONTAL_DEG,
    fovVerticalDeg: DEFAULT_CAMERA_FOV_VERTICAL_DEG,
  }
}
