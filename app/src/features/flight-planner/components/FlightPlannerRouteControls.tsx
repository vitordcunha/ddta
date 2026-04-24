import { Compass, Minus, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { useFlightStore } from "@/features/flight-planner/stores/useFlightStore"

const ROT_MIN = 0
const ROT_MAX = 180
const ROT_STEP = 1

function clampRotation(n: number) {
  return Math.min(ROT_MAX, Math.max(ROT_MIN, n))
}

const PRESETS = [0, 45, 90, 135] as const

export function FlightPlannerRouteControls() {
  const polygon = useFlightStore((s) => s.polygon)
  const params = useFlightStore((s) => s.params)
  const setParams = useFlightStore((s) => s.setParams)

  if (!polygon) {
    return (
      <p className="text-[10px] leading-snug text-[#6c6c6c]">
        Feche a area no mapa para ajustar a rotacao da grade e a sobreposicao das
        passagens.
      </p>
    )
  }

  const { rotationDeg, forwardOverlap, sideOverlap } = params

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-[#8a8a8a]">
        <Compass className="size-3" aria-hidden />
        Grade da rota
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2 text-[11px] text-[#b4b4b4]">
          <span>Rotacao das faixas</span>
          <span className="font-mono tabular-nums text-white">{rotationDeg}°</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            title="Menos 5°"
            className={cn(
              "touch-target flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10",
              "bg-white/[0.06] text-[#e8e8e8] hover:bg-white/10",
            )}
            onClick={() =>
              setParams({ rotationDeg: clampRotation(rotationDeg - 5) })
            }
          >
            <Minus className="size-3.5" aria-hidden />
          </button>
          <input
            type="range"
            className="h-2 min-w-0 flex-1 cursor-pointer accent-[#3ecf8e]"
            min={ROT_MIN}
            max={ROT_MAX}
            step={ROT_STEP}
            value={rotationDeg}
            onChange={(e) =>
              setParams({ rotationDeg: clampRotation(Number(e.target.value)) })
            }
            aria-label="Rotacao da grade em graus"
          />
          <button
            type="button"
            title="Mais 5°"
            className={cn(
              "touch-target flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10",
              "bg-white/[0.06] text-[#e8e8e8] hover:bg-white/10",
            )}
            onClick={() =>
              setParams({ rotationDeg: clampRotation(rotationDeg + 5) })
            }
          >
            <Plus className="size-3.5" aria-hidden />
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((deg) => {
            const active = rotationDeg === deg
            return (
              <button
                key={deg}
                type="button"
                onClick={() => setParams({ rotationDeg: deg })}
                className={cn(
                  "touch-target min-h-9 min-w-[2.5rem] rounded-md border px-2 text-[11px] font-medium transition",
                  active
                    ? "border-[rgba(62,207,142,0.45)] bg-[rgba(62,207,142,0.15)] text-white"
                    : "border-white/10 bg-white/[0.04] text-[#b4b4b4] hover:border-white/15 hover:bg-white/[0.08]",
                )}
              >
                {deg}°
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-[10px] text-[#8a8a8a]">
          <span className="flex justify-between gap-1 text-[#b4b4b4]">
            <span>Sobrepos. frontal</span>
            <span className="font-mono tabular-nums text-white">{forwardOverlap}%</span>
          </span>
          <input
            type="range"
            className="h-2 w-full cursor-pointer accent-[#60A5FA]"
            min={60}
            max={95}
            step={1}
            value={forwardOverlap}
            onChange={(e) =>
              setParams({ forwardOverlap: Number(e.target.value) })
            }
            aria-label="Sobreposicao frontal percentual"
          />
        </label>
        <label className="grid gap-1 text-[10px] text-[#8a8a8a]">
          <span className="flex justify-between gap-1 text-[#b4b4b4]">
            <span>Sobrepos. lateral</span>
            <span className="font-mono tabular-nums text-white">{sideOverlap}%</span>
          </span>
          <input
            type="range"
            className="h-2 w-full cursor-pointer accent-[#60A5FA]"
            min={60}
            max={90}
            step={1}
            value={sideOverlap}
            onChange={(e) => setParams({ sideOverlap: Number(e.target.value) })}
            aria-label="Sobreposicao lateral percentual"
          />
        </label>
      </div>
    </div>
  )
}
