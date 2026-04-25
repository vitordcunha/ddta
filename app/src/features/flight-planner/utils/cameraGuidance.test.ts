import { describe, expect, it } from 'vitest'
import { computeMinShutterSuggestion } from '@/features/flight-planner/utils/cameraGuidance'

describe('computeMinShutterSuggestion', () => {
  it('sugere denom ~400 para GSD 2 cm e 8 m/s (GSD=0,02 m / 8 m/s = 0,0025 s)', () => {
    const t = computeMinShutterSuggestion({ speedMs: 8, gsdCm: 2 })
    expect(t).toMatch(/1\/400/)
  })

  it('retorna aviso amigável com parâmetros inválidos', () => {
    expect(computeMinShutterSuggestion({ speedMs: 0, gsdCm: 2 })).toMatch(/[Vv]álid/)
  })
})
