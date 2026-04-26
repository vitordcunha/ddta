import { describe, expect, it } from 'vitest'
import type { Waypoint } from '@/features/flight-planner/types/waypoint'
import { computeFrustumGeometry } from '@/features/flight-planner/utils/frustumCalculator'

function baseWp(over: Partial<Waypoint> = {}): Waypoint {
  return {
    id: 'wp-1',
    lat: -23.55,
    lng: -46.63,
    altitude: 100,
    altitudeMode: 'agl',
    terrainElevation: 600,
    gimbalPitch: -90,
    heading: 0,
    poiOverride: false,
    index: 0,
    ...over,
  }
}

describe('computeFrustumGeometry', () => {
  it('retorna footprint fechado e quatro faces laterais', () => {
    const g = computeFrustumGeometry(baseWp())
    expect(g).not.toBeNull()
    expect(g!.footprintPolygon.length).toBe(5)
    expect(g!.footprintPolygon[0]).toEqual(g!.footprintPolygon[4])
    expect(g!.sidePolygons.length).toBe(4)
    for (const face of g!.sidePolygons) {
      expect(face.length).toBe(4)
      expect(face[0]).toEqual(face[3])
    }
  })

  it('com nadir o polígono envolve o waypoint (centro aproximado)', () => {
    const w = baseWp({ lat: -10, lng: -20, gimbalPitch: -90, heading: 0 })
    const g = computeFrustumGeometry(w)!
    const xs = g.footprintPolygon.slice(0, 4).map((p) => p[0])
    const ys = g.footprintPolygon.slice(0, 4).map((p) => p[1])
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2
    expect(Math.abs(cx - w.lng)).toBeLessThan(0.002)
    expect(Math.abs(cy - w.lat)).toBeLessThan(0.002)
  })

  it('apex AMSL combina terreno + AGL', () => {
    const g = computeFrustumGeometry(baseWp())!
    expect(g.apex[2]).toBeCloseTo(700, 5)
  })
})
