import { describe, expect, it } from 'vitest'
import { buildChecklist } from '@/features/flight-planner/utils/preFlightChecklist'
import type { WeatherData, FlightAssessment } from '@/features/flight-planner/types'

const baseParams = {
  droneModel: 'Mini 4 Pro' as const,
  altitudeM: 100,
  forwardOverlap: 80,
  sideOverlap: 70,
  rotationDeg: 0,
  speedMs: 8,
}

describe('buildChecklist', () => {
  it('inclui grupos esperados (drone, mídia, regulação, operação, clima)', () => {
    const g = buildChecklist(baseParams, null, null, new Date('2026-04-24T14:00:00Z'))
    const ids = g.map((x) => x.id)
    expect(ids).toEqual(
      expect.arrayContaining(['drone', 'media', 'regulacao', 'operacao', 'clima']),
    )
  })

  it('com clima: lista de itens de clima referencia o vento e a temperatura', () => {
    const w: WeatherData = {
      windSpeedMs: 3,
      windDirectionDeg: 90,
      temperatureC: 22,
      cloudCoveragePct: 40,
      rainMmH: 0,
      weatherCode: 1,
      isDay: true,
    }
    const a: FlightAssessment = { go: true, issues: [], warnings: [], tips: [] }
    const g = buildChecklist(baseParams, w, a, new Date('2026-04-24T14:00:00Z'))
    const clima = g.find((x) => x.id === 'clima')
    expect(clima).toBeDefined()
    const first = clima?.items[0].label ?? ''
    expect(first).toMatch(/3,0|3\.0|22/)
  })
})
