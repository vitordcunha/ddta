import { describe, expect, it } from 'vitest'
import { clampMapZoomToWeatherMapLayer } from './weatherMapLayerZoomBounds'

describe('clampMapZoomToWeatherMapLayer', () => {
  it('does not change zoom for none', () => {
    expect(clampMapZoomToWeatherMapLayer('none', 16)).toBe(16)
  })

  it('clamps RainViewer to max 7', () => {
    expect(clampMapZoomToWeatherMapLayer('radar', 15)).toBe(7)
    expect(clampMapZoomToWeatherMapLayer('radar', 2)).toBe(2)
  })

  it('clamps OWM to max 9', () => {
    expect(clampMapZoomToWeatherMapLayer('owm_wind', 18)).toBe(9)
    expect(clampMapZoomToWeatherMapLayer('owm_clouds', 5)).toBe(5)
  })
})
