import { describe, expect, it } from 'vitest'
import { mergeCalibrationParamChanges } from '@/features/flight-planner/utils/mergeCalibrationParamChanges'
import type { CalibrationRecommendation } from '@/services/projectsService'

describe('mergeCalibrationParamChanges', () => {
  it('prefere menor speedMs e maior forwardOverlap', () => {
    const recs: CalibrationRecommendation[] = [
      {
        id: 'a',
        kind: 'x',
        severity: 'warn',
        rationale: 'r',
        text: 't',
        param_changes: [
          { field: 'speedMs', suggested: 6, current: 8 },
          { field: 'forwardOverlap', suggested: 80, current: 75 },
        ],
        affected_slots: [],
      },
      {
        id: 'b',
        kind: 'y',
        severity: 'warn',
        rationale: 'r2',
        text: 't2',
        param_changes: [{ field: 'speedMs', suggested: 5.5, current: 8 }],
        affected_slots: [],
      },
    ]
    expect(mergeCalibrationParamChanges(recs)).toEqual({
      speedMs: 5.5,
      forwardOverlap: 80,
    })
  })
})
