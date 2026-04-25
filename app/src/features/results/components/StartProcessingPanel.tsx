import { Button, Card } from '@/components/ui'
import { processingPresets } from '@/features/results/mocks/completedProject'
import type { ProcessingPreset } from '@/features/results/types'

interface StartProcessingPanelProps {
  selectedPreset: ProcessingPreset
  onSelectPreset: (preset: ProcessingPreset) => void
  onStart: () => void
  /** Apos uma falha — textos e botao de nova tentativa. */
  isRetry?: boolean
}

export function StartProcessingPanel({ selectedPreset, onSelectPreset, onStart, isRetry }: StartProcessingPanelProps) {
  const details = processingPresets[selectedPreset]

  return (
    <Card className="space-y-4">
      <h3 className="text-base font-semibold text-neutral-100">
        {isRetry ? 'Tentar novamente' : 'Iniciar processamento'}
      </h3>
      {isRetry ? (
        <p className="text-sm text-neutral-500">
          O processamento anterior nao foi concluido. Ajuste as imagens ou o preset e reexecute.
        </p>
      ) : null}
      <div className="grid gap-2">
        {(Object.keys(processingPresets) as ProcessingPreset[]).map((preset) => {
          const data = processingPresets[preset]
          const active = selectedPreset === preset
          return (
            <button
              key={preset}
              type="button"
              onClick={() => onSelectPreset(preset)}
              className={[
                'rounded-xl border p-3 text-left transition',
                active ? 'border-primary-500 bg-primary-500/10' : 'border-neutral-800 bg-neutral-950 hover:border-neutral-700',
              ].join(' ')}
            >
              <p className="font-medium text-neutral-100">{data.label}</p>
              <p className="text-xs text-neutral-400">{data.description}</p>
            </button>
          )
        })}
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm">
        <p className="text-neutral-300">GSD esperado: {details.expectedGsd}</p>
        <p className="text-neutral-400">Tempo estimado: {details.eta}</p>
      </div>

      <Button className="w-full" onClick={onStart}>
        {isRetry ? 'Tentar novamente' : 'Iniciar processamento'}
      </Button>
    </Card>
  )
}
