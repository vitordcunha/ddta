import type { PersistedFlightPlan } from '@/features/flight-planner/stores/useFlightStore'
import { useFlightStore } from '@/features/flight-planner/stores/useFlightStore'

const prefix = 'dd-planner-draft:'

const skipHydrateKey = (projectId: string) => `dd-planner-skip-initial:${projectId}`

/**
 * Após o usuário descartar o plano local (rascunho + estado no mapa), não reidratamos
 * a partir do plano salvo no projeto até a próxima gravação bem-sucedida.
 * sessionStorage: por aba; evita reabrir o painel e trazer o snapshot antigo do `initialPlan`.
 */
export function setSessionSkipHydrateFromSavedPlan(projectId: string) {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(skipHydrateKey(projectId), '1')
  } catch {
    /* ignore */
  }
}

export function clearSessionSkipHydrateFromSavedPlan(projectId: string) {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(skipHydrateKey(projectId))
  } catch {
    /* ignore */
  }
}

export function shouldSessionSkipHydrateFromSavedPlan(projectId: string): boolean {
  if (typeof sessionStorage === 'undefined') return false
  try {
    return sessionStorage.getItem(skipHydrateKey(projectId)) === '1'
  } catch {
    return false
  }
}

/**
 * Limpa polígono, rota, rascunho em disco e sinaliza que o plano salvo no projeto
 * não deve recarregar até salvar de novo. Use no botão "Limpar" / descarte total.
 */
export function discardLocalFlightPlanSession(projectId: string) {
  useFlightStore.getState().resetPlan()
  clearFlightPlanDraft(projectId)
  setSessionSkipHydrateFromSavedPlan(projectId)
}

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
