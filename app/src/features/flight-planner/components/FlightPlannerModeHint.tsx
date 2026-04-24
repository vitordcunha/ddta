import { useState } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "dd-planner-modes-hint"

export function FlightPlannerModeHint() {
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== "1"
    } catch {
      return true
    }
  })

  if (!visible) return null

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1")
    } catch {
      /* ignore */
    }
    setVisible(false)
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-white/10 bg-[#141414]/90 px-2.5 py-2 text-[11px] leading-snug text-[#b4b4b4] backdrop-blur-sm",
        "shadow-sm",
      )}
    >
      <div className="mb-0.5 flex items-start justify-between gap-1">
        <p className="pr-1 font-medium text-[#e0e0e0]">Dica</p>
        <button
          type="button"
          onClick={dismiss}
          className="touch-target -m-0.5 flex min-h-8 min-w-8 items-center justify-center rounded-md text-[#6b6b6b] hover:text-white"
          title="Nao mostrar de novo"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <p>
        Em <strong className="text-[#fafafa]">Desenhar</strong>, toques no mapa
        adicionam pontos; em <strong className="text-[#fafafa]">Navegar</strong>,
        arraste o mapa sem desenhar.
      </p>
    </div>
  )
}
