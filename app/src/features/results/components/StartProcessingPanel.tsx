import { Button, Card } from '@/components/ui'
import { processingPresets } from '@/features/results/mocks/completedProject'
import type { ProcessingPreset } from '@/features/results/types'

interface StartProcessingPanelProps {
  selectedPreset: ProcessingPreset
  onSelectPreset: (preset: ProcessingPreset) => void
  onStart: () => void
  /** Apos uma falha — textos e botao de nova tentativa. */
  isRetry?: boolean
  /** Projeto ja concluido — novo processamento completo substitui entregas ao terminar. */
  isRedo?: boolean
  onDismiss?: () => void
  /** Se o ODM terminou mas a etapa COG falhou — retoma sem reprocessar imagens. */
  onFinalizeStuck?: () => void
  enablePreview?: boolean
  onTogglePreview?: (enabled: boolean) => void
}

export function StartProcessingPanel({
  selectedPreset,
  onSelectPreset,
  onStart,
  isRetry,
  isRedo,
  onDismiss,
  onFinalizeStuck,
  enablePreview = false,
  onTogglePreview,
}: StartProcessingPanelProps) {
  const details = processingPresets[selectedPreset]

  const title = isRedo ? 'Refazer processamento' : isRetry ? 'Tentar novamente' : 'Iniciar processamento'
  const startLabel = isRedo ? 'Refazer processamento' : isRetry ? 'Tentar novamente' : 'Iniciar processamento'

  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-neutral-100">{title}</h3>
        {isRedo && onDismiss ? (
          <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={onDismiss}>
            Cancelar
          </Button>
        ) : null}
      </div>
      {isRedo ? (
        <p className="text-sm text-neutral-500">
          Um novo processamento completo sera enfileirado. As entregas atuais permanecem ate o novo fluxo concluir.
        </p>
      ) : null}
      {isRetry && !isRedo ? (
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

      {onTogglePreview && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-neutral-100">Preview em tempo real</p>
              <p className="text-xs text-neutral-400">
                Gera ortomosaico de baixa resolucao (~15 min) em paralelo ao processamento completo. Requer mais
                recursos do servidor.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enablePreview}
              onClick={() => onTogglePreview(!enablePreview)}
              className={[
                'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
                enablePreview ? 'bg-amber-500' : 'bg-neutral-700',
              ].join(' ')}
            >
              <span
                className={[
                  'inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200',
                  enablePreview ? 'translate-x-4' : 'translate-x-0',
                ].join(' ')}
              />
            </button>
          </div>
          {enablePreview && (
            <p className="mt-2 text-xs text-amber-400">
              O servidor ODM processara dois tasks simultaneamente. Evite em ambientes com pouca RAM.
            </p>
          )}
        </div>
      )}

      <Button className="w-full" onClick={onStart}>
        {startLabel}
      </Button>

      {isRetry && !isRedo && onFinalizeStuck ? (
        <Button variant="secondary" className="w-full" onClick={() => void onFinalizeStuck()}>
          Apenas retomar finalizacao (COG e resultados)
        </Button>
      ) : null}
    </Card>
  )
}
