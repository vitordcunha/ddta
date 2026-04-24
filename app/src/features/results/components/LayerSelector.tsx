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
    <div className="inline-flex flex-wrap rounded-full border border-[#2e2e2e] bg-[#0f0f0f] p-1">
      {(Object.keys(labels) as ResultLayerId[]).map((layer) => (
        <button
          key={layer}
          type="button"
          onClick={() => onChange(layer)}
          className={[
            'rounded-full px-3 py-1 text-xs transition',
            layer === activeLayer
              ? 'bg-[rgba(62,207,142,0.12)] text-[#3ecf8e]'
              : 'text-[#898989] hover:text-[#fafafa]',
          ].join(' ')}
        >
          {labels[layer]}
        </button>
      ))}
    </div>
  )
}
