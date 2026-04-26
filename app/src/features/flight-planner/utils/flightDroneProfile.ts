import type { FlightParams, DroneSpec } from '@/features/flight-planner/types'
import type { ApiDroneModel } from '@/features/flight-planner/types/droneModelApi'
import type { DroneCameraParams } from '@/features/flight-planner/utils/defaultDroneCamera'
import { getDroneSpec } from '@/features/flight-planner/utils/droneSpecs'

/** Perfil ativo para GSD, overlap, frustum e clima (autonomia estimada usa batteryTimeMin). */
export type FlightDroneProfile = {
  id: string | null
  name: string
  sensorWidthMm: number
  sensorHeightMm: number
  focalLengthMm: number
  imageWidthPx: number
  imageHeightPx: number
  fovHorizontalDeg: number
  fovVerticalDeg: number
  maxSpeedMs: number
  batteryTimeMin: number
}

function batteryHeuristic(name: string, maxSpeedMs: number): number {
  const n = name.toLowerCase()
  if (n.includes('mini')) return Math.round(32 + maxSpeedMs * 0.2)
  if (n.includes('m300') || n.includes('m350')) return 55
  if (n.includes('phantom')) return 28
  if (n.includes('mavic')) return 44
  if (n.includes('air')) return 40
  return Math.round(36 + maxSpeedMs * 0.15)
}

function fromApi(m: ApiDroneModel): FlightDroneProfile {
  return {
    id: m.id,
    name: m.name,
    sensorWidthMm: m.sensor_width_mm,
    sensorHeightMm: m.sensor_height_mm,
    focalLengthMm: m.focal_length_mm,
    imageWidthPx: m.image_width_px,
    imageHeightPx: m.image_height_px,
    fovHorizontalDeg: m.fov_horizontal_deg,
    fovVerticalDeg: m.fov_vertical_deg,
    maxSpeedMs: m.max_speed_ms,
    batteryTimeMin: batteryHeuristic(m.name, m.max_speed_ms),
  }
}

/**
 * Resolve sensor, FOV e limites a partir do catálogo (API) ou tabela legada `droneSpecs`.
 */
export function resolveFlightDroneProfile(
  params: FlightParams,
  catalog: ApiDroneModel[] | undefined,
): FlightDroneProfile {
  const list = catalog ?? []
  const byId =
    params.droneModelId != null ? list.find((m) => m.id === params.droneModelId) : undefined
  const byName = byId ?? list.find((m) => m.name === params.droneModel)
  if (byName) {
    return fromApi(byName)
  }
  const spec = getDroneSpec(params.droneModel)
  const sw = spec.sensorWidthMm
  const sh = spec.sensorHeightMm
  const fl = Math.max(1e-6, spec.focalLengthMm)
  const hRad = 2 * Math.atan(sw / (2 * fl))
  const vRad = 2 * Math.atan(sh / (2 * fl))
  const toDeg = (r: number) => (r * 180) / Math.PI
  return {
    id: null,
    name: spec.model,
    sensorWidthMm: sw,
    sensorHeightMm: sh,
    focalLengthMm: spec.focalLengthMm,
    imageWidthPx: spec.imageWidthPx,
    imageHeightPx: spec.imageHeightPx,
    fovHorizontalDeg: toDeg(hRad),
    fovVerticalDeg: toDeg(vRad),
    maxSpeedMs: spec.maxSpeedMs,
    batteryTimeMin: spec.batteryTimeMin,
  }
}

export function profileToDroneSpec(p: FlightDroneProfile): DroneSpec {
  return {
    model: p.name,
    sensorWidthMm: p.sensorWidthMm,
    sensorHeightMm: p.sensorHeightMm,
    focalLengthMm: p.focalLengthMm,
    imageWidthPx: p.imageWidthPx,
    imageHeightPx: p.imageHeightPx,
    maxSpeedMs: p.maxSpeedMs,
    batteryTimeMin: p.batteryTimeMin,
  }
}

export function profileToCameraParams(p: FlightDroneProfile): DroneCameraParams {
  return {
    fovHorizontalDeg: p.fovHorizontalDeg,
    fovVerticalDeg: p.fovVerticalDeg,
  }
}

/** Campos opcionais gravados no snapshot de calibração / consumidos pelo backend. */
export function profileToCalibrationSnapshotFields(p: FlightDroneProfile): Record<string, number> {
  return {
    sensorWidthMm: p.sensorWidthMm,
    sensorHeightMm: p.sensorHeightMm,
    focalLengthMm: p.focalLengthMm,
    fovHorizontalDeg: p.fovHorizontalDeg,
    fovVerticalDeg: p.fovVerticalDeg,
  }
}
