import type { DroneModel, DroneSpec, SelectOption } from '@/features/flight-planner/types'

const DRONE_SPECS: Record<DroneModel, DroneSpec> = {
  'Mini 4 Pro': {
    model: 'Mini 4 Pro',
    sensorWidthMm: 9.6,
    sensorHeightMm: 7.2,
    focalLengthMm: 6.72,
    imageWidthPx: 8064,
    imageHeightPx: 6048,
    maxSpeedMs: 16,
    batteryTimeMin: 34,
  },
  'Mini 5 Pro': {
    model: 'Mini 5 Pro',
    sensorWidthMm: 12.8,
    sensorHeightMm: 9.6,
    focalLengthMm: 8.8,
    imageWidthPx: 8192,
    imageHeightPx: 6144,
    maxSpeedMs: 18,
    batteryTimeMin: 36,
  },
  'Air 3': {
    model: 'Air 3',
    sensorWidthMm: 9.6,
    sensorHeightMm: 7.2,
    focalLengthMm: 6.7,
    imageWidthPx: 8064,
    imageHeightPx: 6048,
    maxSpeedMs: 21,
    batteryTimeMin: 42,
  },
  'Mavic 3': {
    model: 'Mavic 3',
    sensorWidthMm: 17.3,
    sensorHeightMm: 13,
    focalLengthMm: 12.3,
    imageWidthPx: 5280,
    imageHeightPx: 3956,
    maxSpeedMs: 21,
    batteryTimeMin: 46,
  },
  'Phantom 4': {
    model: 'Phantom 4',
    sensorWidthMm: 13.2,
    sensorHeightMm: 8.8,
    focalLengthMm: 8.8,
    imageWidthPx: 5472,
    imageHeightPx: 3648,
    maxSpeedMs: 20,
    batteryTimeMin: 28,
  },
}

export function getDroneOptions(): SelectOption[] {
  return Object.keys(DRONE_SPECS).map((model) => ({
    label: model,
    value: model as DroneModel,
  }))
}

export function getDroneSpec(model: DroneModel): DroneSpec {
  return DRONE_SPECS[model]
}
