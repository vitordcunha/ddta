import type { ResultLayerId } from '@/features/results/types'

interface LayerSelectorProps {
  activeLayer: ResultLayerId
  onChange: (layer: ResultLayerId) => void
  /** Quando true, mostra a camada de nuvem esparsa (GeoJSON SfM). */
  sparseLayerUnlocked?: boolean
  /** Camadas que ainda não têm dados gerados (desabilitadas na UI). */
  unavailableLayers?: ResultLayerId[]
  showRealFlightPath?: boolean
  onRealFlightPathChange?: (v: boolean) => void
}

const labels: Record<ResultLayerId, string> = {
  orthophoto: 'Ortomosaico',
  dsm: 'MDS',
  dtm: 'MDT',
  contours: 'Curvas de Nivel',
  sparse: 'Nuvem esparsa',
}

const baseLayers: ResultLayerId[] = ['orthophoto', 'dsm', 'dtm', 'contours']

export function LayerSelector({
  activeLayer,
  onChange,
  sparseLayerUnlocked = false,
  unavailableLayers = [],
  showRealFlightPath = false,
  onRealFlightPathChange,
}: LayerSelectorProps) {
  const layers: ResultLayerId[] = sparseLayerUnlocked ? [...baseLayers, 'sparse'] : baseLayers

  return (
    <div className="space-y-2">
      <div className="inline-flex flex-wrap rounded-full border border-[#2e2e2e] bg-[#0f0f0f] p-1">
        {layers.map((layer) => {
          const isUnavailable = unavailableLayers.includes(layer)
          const isActive = layer === activeLayer
          return (
            <button
              key={layer}
              type="button"
              onClick={() => !isUnavailable && onChange(layer)}
              disabled={isUnavailable}
              title={isUnavailable ? 'Não disponível para este projeto' : undefined}
              className={[
                'rounded-full px-3 py-1 text-xs transition',
                isActive
                  ? 'bg-[rgba(62,207,142,0.12)] text-[#3ecf8e]'
                  : isUnavailable
                    ? 'cursor-not-allowed text-[#444]'
                    : 'text-[#898989] hover:text-[#fafafa]',
              ].join(' ')}
            >
              {labels[layer]}
            </button>
          )
        })}
      </div>
      {onRealFlightPathChange ? (
        <label className="flex cursor-pointer items-center gap-2 text-xs text-neutral-400">
          <input
            type="checkbox"
            className="size-4 shrink-0 cursor-pointer rounded border border-white/20 bg-white/[0.04] text-primary-500"
            checked={showRealFlightPath}
            onChange={(e) => onRealFlightPathChange(e.target.checked)}
          />
          Rota real do voo
        </label>
      ) : null}
    </div>
  )
}
