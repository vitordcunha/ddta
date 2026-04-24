import { Minus, Plus } from "lucide-react"
import { useMap } from "react-leaflet"
import { cn } from "@/lib/utils"

const BTN =
  "touch-target flex h-12 w-12 items-center justify-center text-[#e8e8e8] transition hover:bg-white/10 active:bg-white/15"

/**
 * Zoom +/- (bloco de botoes). Posicionamento fica a cargo do pai (ex.: canto inferior esquerdo).
 */
export function PlannerMapZoomControl() {
  const map = useMap()
  return (
    <div className="pointer-events-auto flex flex-col overflow-hidden rounded-xl border border-white/15 bg-[#121212]/90 shadow-lg backdrop-blur-md">
      <button
        type="button"
        className={cn(BTN, "border-b border-white/10")}
        onClick={() => {
          map.zoomIn(1)
        }}
        title="Aproximar"
      >
        <Plus className="size-5" />
      </button>
      <button
        type="button"
        className={cn(BTN)}
        onClick={() => {
          map.zoomOut(1)
        }}
        title="Afastar"
      >
        <Minus className="size-5" />
      </button>
    </div>
  )
}
