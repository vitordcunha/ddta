import { describe, expect, it } from 'vitest'
import { getSparseCloudMaxPoints } from '@/features/map-engine/utils/getSparseCloudMaxPoints'

describe('getSparseCloudMaxPoints', () => {
  it('2D: sempre 50k', () => {
    expect(getSparseCloudMaxPoints('low', false)).toBe(50_000)
    expect(getSparseCloudMaxPoints('high', false)).toBe(50_000)
  })

  it('3D em low: 15k (O.10)', () => {
    expect(getSparseCloudMaxPoints('low', true)).toBe(15_000)
  })

  it('3D em high: 50k', () => {
    expect(getSparseCloudMaxPoints('high', true)).toBe(50_000)
  })

  it("tier 'none' com 2D: 50k", () => {
    expect(getSparseCloudMaxPoints('none', false)).toBe(50_000)
  })
})
