import { describe, expect, it } from 'vitest'
import * as turf from '@turf/turf'
import { buildCalibrationMission, buildCalibrationPolygon, buildCalibrationStats } from '@/features/flight-planner/utils/calibrationPlan'

const baseParams = {
  droneModel: 'Mini 4 Pro' as const,
  altitudeM: 100,
  forwardOverlap: 80,
  sideOverlap: 70,
  rotationDeg: 0,
  speedMs: 8,
}

/** ~500 m x 500 m em SP (aprox.) */
const largeField = turf.polygon([
  [
    [-47.06, -22.91],
    [-47.055, -22.91],
    [-47.055, -22.905],
    [-47.06, -22.905],
    [-47.06, -22.91],
  ],
])

describe('buildCalibrationMission', () => {
  it('retorna polígono recortado, ≥5 waypoints e estatísticas', () => {
    const m = buildCalibrationMission(largeField, baseParams, null)
    expect(m).not.toBeNull()
    expect(m!.waypoints.length).toBeGreaterThanOrEqual(5)
    expect(m!.stats.estimatedPhotos).toBeGreaterThan(0)
    expect(m!.stats.estimatedTimeMin).toBeLessThan(5)
    expect(turf.area(m!.calibrationPolygon)).toBeLessThan(turf.area(largeField))
  })
})

describe('buildCalibrationPolygon', () => {
  it('delega à missão e retorna Feature Polygon', () => {
    const p = buildCalibrationPolygon(largeField, baseParams)
    expect(p?.geometry.type).toBe('Polygon')
  })
})

describe('buildCalibrationStats', () => {
  it('expõe fotos e tempo estimados', () => {
    const s = buildCalibrationStats(largeField, baseParams)
    expect(s).not.toBeNull()
    expect(s!.waypointCount).toBeGreaterThanOrEqual(5)
    expect(s!.estimatedPhotos).toBeGreaterThan(0)
  })
})
