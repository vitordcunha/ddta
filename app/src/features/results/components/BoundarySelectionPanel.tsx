import { Boxes, ChevronRight, PencilLine, Trash2 } from 'lucide-react'
import { Button, Card } from '@/components/ui'
import { useResultsViewStore } from '@/features/results/stores/useResultsViewStore'

interface BoundarySelectionPanelProps {
  onConfirm: (boundary: GeoJSON.GeoJsonObject) => void
  onSkip: () => void
  onViewCloud3D?: () => void
  sparseCloudAvailable?: boolean
}

export function BoundarySelectionPanel({
  onConfirm,
  onSkip,
  onViewCloud3D,
  sparseCloudAvailable,
}: BoundarySelectionPanelProps) {
  const tool = useResultsViewStore((s) => s.tool)
  const setTool = useResultsViewStore((s) => s.setTool)
  const boundaryPoints = useResultsViewStore((s) => s.boundaryPoints)
  const clearBoundaryPoints = useResultsViewStore((s) => s.clearBoundaryPoints)
  const buildBoundaryGeoJson = useResultsViewStore((s) => s.buildBoundaryGeoJson)

  const canConfirm = boundaryPoints.length >= 3

  function handleConfirm() {
    const geojson = buildBoundaryGeoJson()
    if (!geojson) return
    onConfirm(geojson)
  }

  return (
    <Card className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-neutral-100">Selecionar área de processamento</h3>
        <p className="mt-1 text-sm text-neutral-400">
          A nuvem esparsa foi gerada. Desenhe um polígono no mapa para delimitar a área que deseja processar,
          ou processe a área completa sem recorte.
        </p>
      </div>

      {sparseCloudAvailable && onViewCloud3D ? (
        <button
          type="button"
          onClick={onViewCloud3D}
          className="flex w-full items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-[#3ecf8e] transition hover:border-neutral-700"
        >
          <Boxes className="size-4 shrink-0" />
          <span className="flex-1 text-left">Visualizar nuvem esparsa em 3D</span>
          <ChevronRight className="size-3.5 text-neutral-600" />
        </button>
      ) : null}

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Ferramenta de desenho</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTool(tool === 'boundary' ? 'none' : 'boundary')}
            className={[
              'flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition',
              tool === 'boundary'
                ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                : 'border-neutral-800 bg-neutral-950 text-neutral-300 hover:border-neutral-700',
            ].join(' ')}
          >
            <PencilLine className="size-4" />
            {tool === 'boundary' ? 'Clique no mapa para adicionar pontos' : 'Ativar desenho'}
          </button>
          {boundaryPoints.length > 0 ? (
            <button
              type="button"
              onClick={clearBoundaryPoints}
              className="rounded-lg border border-neutral-800 px-3 py-2 text-neutral-500 transition hover:border-red-900/60 hover:text-red-400"
              title="Limpar pontos"
            >
              <Trash2 className="size-4" />
            </button>
          ) : null}
        </div>
        {boundaryPoints.length > 0 ? (
          <p className="text-xs text-neutral-500">
            {boundaryPoints.length} ponto{boundaryPoints.length !== 1 ? 's' : ''} desenhado{boundaryPoints.length !== 1 ? 's' : ''}.
            {boundaryPoints.length < 3 ? ' Adicione pelo menos 3 pontos para confirmar.' : ' Polígono pronto para confirmar.'}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Button className="w-full" disabled={!canConfirm} onClick={handleConfirm}>
          Confirmar área selecionada
        </Button>
        <Button variant="secondary" className="w-full" onClick={onSkip}>
          Processar área completa (sem recorte)
        </Button>
      </div>
    </Card>
  )
}
