import { Hand, Map as MapIcon, Pencil, Pentagon, Undo2, Trash2 } from "lucide-react"
import { useSearchParams } from "react-router-dom"
import { Button } from "@/components/ui"
import { cn } from "@/lib/utils"
import { FlightPlannerModeHint } from "@/features/flight-planner/components/FlightPlannerModeHint"
import { FlightPlannerRouteControls } from "@/features/flight-planner/components/FlightPlannerRouteControls"
import { useFlightPlannerMapHotkeys } from "@/features/flight-planner/hooks/useFlightPlannerMapHotkeys"
import {
  PLANNER_BASE_LAYER_IDS,
  getPlannerBaseLayerConfig,
} from "@/features/flight-planner/constants/mapBaseLayers"
import { useFlightStore } from "@/features/flight-planner/stores/useFlightStore"
import type { PlannerInteractionMode } from "@/features/flight-planner/stores/useFlightStore"
import { closeDraftToPolygon } from "@/features/flight-planner/utils/polygonDraft"
import { discardLocalFlightPlanSession } from "@/features/flight-planner/utils/flightPlanDraftStorage"

const modes: { id: PlannerInteractionMode; label: string; icon: typeof Hand }[] = [
  { id: "navigate", label: "Navegar", icon: Hand },
  { id: "draw", label: "Desenhar", icon: Pencil },
]

export function FlightPlannerMapToolbar() {
  useFlightPlannerMapHotkeys()
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get("project")

  const draftPoints = useFlightStore((s) => s.draftPoints)
  const setDraftPoints = useFlightStore((s) => s.setDraftPoints)
  const popLastDraftPoint = useFlightStore((s) => s.popLastDraftPoint)
  const setPolygon = useFlightStore((s) => s.setPolygon)
  const mode = useFlightStore((s) => s.plannerInteractionMode)
  const setMode = useFlightStore((s) => s.setPlannerInteractionMode)
  const baseLayer = useFlightStore((s) => s.plannerBaseLayer)
  const setBaseLayer = useFlightStore((s) => s.setPlannerBaseLayer)

  const onClose = () => {
    if (draftPoints.length < 3) return
    const closed = closeDraftToPolygon(draftPoints)
    if (!closed) return
    setPolygon(closed)
    setDraftPoints([])
  }

  const onClear = () => {
    if (projectId) {
      discardLocalFlightPlanSession(projectId)
    } else {
      setDraftPoints([])
      setPolygon(null)
    }
  }

  return (
    <div
      className={cn(
        "flex max-w-[min(100vw-2rem,20rem)] flex-col gap-3 p-0.5",
        "text-[13px] text-[#e8e8e8]",
      )}
    >
      <FlightPlannerModeHint />

      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#8a8a8a]">
        Ferramentas
      </div>
      <div
        className="flex rounded-xl border border-white/10 bg-black/20 p-0.5"
        role="group"
        aria-label="Modo do mapa"
      >
        {modes.map((m) => {
          const Icon = m.icon
          const active = mode === m.id
          return (
            <button
              key={m.id}
              type="button"
              title={m.label}
              onClick={() => setMode(m.id)}
              className={cn(
                "touch-target flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition",
                active
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-[#a3a3a3] hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon className="size-3.5 shrink-0" aria-hidden />
              <span className="hidden min-[360px]:inline">{m.label}</span>
            </button>
          )
        })}
      </div>

      <div className="space-y-2" role="radiogroup" aria-label="Estilo do mapa">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-[#8a8a8a]">
          <MapIcon className="size-3" aria-hidden />
          Estilo do mapa
        </div>
        <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {PLANNER_BASE_LAYER_IDS.map((id) => {
            const sel = baseLayer === id
            return (
              <li key={id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={sel}
                  onClick={() => setBaseLayer(id)}
                  className={cn(
                    "touch-target w-full min-h-11 rounded-lg border px-2.5 text-left text-xs font-medium transition",
                    sel
                      ? "border-[rgba(62,207,142,0.4)] bg-[rgba(62,207,142,0.12)] text-white"
                      : "border-white/10 bg-white/[0.04] text-[#b4b4b4] hover:border-white/15 hover:bg-white/[0.08]",
                  )}
                >
                  {getPlannerBaseLayerConfig(id).label}
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      <div
        className="rounded-xl border border-white/10 bg-black/15 p-2.5"
        aria-label="Ajuste da grade de voo"
      >
        <FlightPlannerRouteControls />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          className="h-11 min-h-11 flex-1 min-[360px]:flex-none"
          disabled={draftPoints.length < 3}
          onClick={onClose}
          type="button"
        >
          <Pentagon className="mr-1 size-3.5" />
          Fechar
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-11 min-h-11 flex-1 min-[360px]:flex-none"
          disabled={draftPoints.length < 1}
          onClick={() => popLastDraftPoint()}
          type="button"
        >
          <Undo2 className="mr-1 size-3.5" />
          Desfazer
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-11 min-h-11 flex-1 min-[360px]:flex-none"
          onClick={onClear}
          type="button"
        >
          <Trash2 className="mr-1 size-3.5" />
          Limpar
        </Button>
      </div>

      <p className="text-[10px] leading-tight text-[#5c5c5c]">
        Atalhos: D / N (modo), U ou Z (desfaz ponto), Esc (limpa rascunho), [ / ]
        (rotacao, com area fechada).
      </p>
    </div>
  )
}
