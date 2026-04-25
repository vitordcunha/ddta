const SKIP = (projectId: string) => `dronedata:preflight:skipKmzModal:${projectId}`
const CHECKS = (projectId: string) => `dronedata:preflight:checklistState:${projectId}`

export function readPreFlightKmzModalSkip(projectId: string): boolean {
  try {
    return localStorage.getItem(SKIP(projectId)) === '1'
  } catch {
    return false
  }
}

export function writePreFlightKmzModalSkip(projectId: string, skip: boolean) {
  try {
    if (skip) localStorage.setItem(SKIP(projectId), '1')
    else localStorage.removeItem(SKIP(projectId))
  } catch {
    /* ignore */
  }
}

export function readChecklistChecked(projectId: string): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(CHECKS(projectId))
    if (!raw) return {}
    const o = JSON.parse(raw) as unknown
    if (o && typeof o === 'object' && !Array.isArray(o)) return o as Record<string, boolean>
  } catch {
    /* ignore */
  }
  return {}
}

export function writeChecklistChecked(projectId: string, state: Record<string, boolean>) {
  try {
    localStorage.setItem(CHECKS(projectId), JSON.stringify(state))
  } catch {
    /* ignore */
  }
}
