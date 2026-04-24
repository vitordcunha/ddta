import { Crosshair, Ruler, Square, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui'
import { useResultsMapMeasurements } from '@/features/results/hooks/useResultsMapMeasurements'
import { useResultsViewStore } from '@/features/results/stores/useResultsViewStore'

export function ResultsMapToolsOverlay() {
  const opacity = useResultsViewStore((s) => s.opacity)
  const setOpacity = useResultsViewStore((s) => s.setOpacity)
  const tool = useResultsViewStore((s) => s.tool)
  const setTool = useResultsViewStore((s) => s.setTool)
  const clearDrawing = useResultsViewStore((s) => s.clearDrawing)
  const { distanceResult, areaResult, elevationPoint } = useResultsMapMeasurements()

  return (
    <>
      <div className="pointer-events-auto absolute right-3 top-3 z-[2000] flex flex-col gap-2">
        <div className="flex flex-col items-center gap-1 rounded-xl border border-[#2e2e2e] bg-[#171717]/90 p-2 backdrop-blur-md">
          <span className="text-[10px] font-mono uppercase tracking-[1.2px] text-neutral-500">Opac</span>
          <input
            type="range"
            min={0}
            max={100}
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
            className="h-28 [writing-mode:vertical-lr]"
            aria-label="Opacidade da camada"
          />
        </div>
      </div>

      <div className="pointer-events-auto absolute bottom-3 left-3 z-[2000] flex flex-wrap gap-2 rounded-xl border border-[#2e2e2e] bg-[#171717]/90 p-2 backdrop-blur-md">
        <Button size="sm" variant={tool === 'distance' ? 'primary' : 'outline'} onClick={() => setTool('distance')}>
          <Ruler className="mr-1 h-4 w-4" />
          Distancia
        </Button>
        <Button size="sm" variant={tool === 'area' ? 'primary' : 'outline'} onClick={() => setTool('area')}>
          <Square className="mr-1 h-4 w-4" />
          Area
        </Button>
        <Button size="sm" variant={tool === 'elevation' ? 'primary' : 'outline'} onClick={() => setTool('elevation')}>
          <Crosshair className="mr-1 h-4 w-4" />
          Cota
        </Button>
        <Button size="sm" variant="outline" onClick={() => clearDrawing()}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {(distanceResult || areaResult || elevationPoint) && (
        <div className="pointer-events-auto absolute bottom-3 right-3 z-[2000] max-w-xs rounded-xl border border-[#2e2e2e] bg-[#171717]/90 p-3 text-xs text-neutral-200 backdrop-blur-md">
          {distanceResult ? <p>Distancia: {distanceResult}</p> : null}
          {areaResult ? <p>Area: {areaResult}</p> : null}
          {elevationPoint ? <p>Cota: 1.024,3 m (datum WGS84)</p> : null}
        </div>
      )}
    </>
  )
}
