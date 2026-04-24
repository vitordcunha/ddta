import { useEffect } from "react"
import { useFlightStore } from "@/features/flight-planner/stores/useFlightStore"

const TYPING_SELECTOR = "input, textarea, select, [contenteditable='true']"

function clampRotationDeg(n: number) {
  return Math.min(180, Math.max(0, n))
}

function isTypingTarget(target: EventTarget | null) {
  if (!target || !(target instanceof Element)) return false
  return Boolean(target.closest(TYPING_SELECTOR))
}

/**
 * D desenho, N navegar, U ou Z desfaz vertice, Esc limpa o rascunho (pontos em aberto).
 * [ / ] ajustam rotacao da grade em 5° quando ha poligono fechado.
 * Ignora quando ha Ctrl/Meta/Alt (ex.: atalhos do browser) ou foco em campo.
 */
export function useFlightPlannerMapHotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (isTypingTarget(e.target)) return

      const k = e.key
      if (k === "d" || k === "D") {
        e.preventDefault()
        useFlightStore.getState().setPlannerInteractionMode("draw")
        return
      }
      if (k === "n" || k === "N") {
        e.preventDefault()
        useFlightStore.getState().setPlannerInteractionMode("navigate")
        return
      }
      if (k === "u" || k === "U" || k === "z" || k === "Z") {
        e.preventDefault()
        useFlightStore.getState().popLastDraftPoint()
        return
      }
      if (k === "Escape") {
        const { draftPoints, setDraftPoints } = useFlightStore.getState()
        if (draftPoints.length === 0) return
        e.preventDefault()
        setDraftPoints([])
        return
      }
      if (k === "[" || k === "]") {
        const { polygon, params, setParams } = useFlightStore.getState()
        if (!polygon) return
        e.preventDefault()
        const delta = k === "[" ? -5 : 5
        setParams({
          rotationDeg: clampRotationDeg(params.rotationDeg + delta),
        })
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])
}
