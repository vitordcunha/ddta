import type { ResultLayerId } from '@/features/results/types'

interface LayerSelectorProps {
  activeLayer: ResultLayerId
  onChange: (layer: ResultLayerId) => void
}

const labels: Record<ResultLayerId, string> = {
  orthophoto: 'Ortomosaico',
  dsm: 'MDS',
  dtm: 'MDT',
  contours: 'Curvas de Nivel',
}

export function LayerSelector({ activeLayer, onChange }: LayerSelectorProps) {
  return (
    <div className="inline-flex rounded-full border border-neutral-800 bg-neutral-950 p-1">
      {(Object.keys(labels) as ResultLayerId[]).map((layer) => (
        <button
          key={layer}
          type="button"
          onClick={() => onChange(layer)}
          className={[
            'rounded-full px-3 py-1 text-xs transition',
            layer === activeLayer ? 'bg-primary-500/15 text-primary-300' : 'text-neutral-400 hover:text-neutral-200',
          ].join(' ')}
        >
          {labels[layer]}
        </button>
      ))}
    </div>
  )
}
