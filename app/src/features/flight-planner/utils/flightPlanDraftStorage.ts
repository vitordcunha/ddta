import type { PersistedFlightPlan } from '@/features/flight-planner/stores/useFlightStore'

const prefix = 'dd-planner-draft:'

export function flightPlanDraftKey(projectId: string) {
  return `${prefix}${projectId}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function readFlightPlanDraft(projectId: string): PersistedFlightPlan | null {
  try {
    const raw = localStorage.getItem(flightPlanDraftKey(projectId))
    if (!raw) return null
    const data = JSON.parse(raw) as unknown
    if (!isRecord(data)) return null
    if (!isRecord(data.params)) return null
    return data as unknown as PersistedFlightPlan
  } catch {
    return null
  }
}

export function writeFlightPlanDraft(projectId: string, plan: PersistedFlightPlan) {
  try {
    localStorage.setItem(flightPlanDraftKey(projectId), JSON.stringify(plan))
  } catch {
    // ignore quota / private mode
  }
}

export function clearFlightPlanDraft(projectId: string) {
  try {
    localStorage.removeItem(flightPlanDraftKey(projectId))
  } catch {
    // ignore
  }
}
