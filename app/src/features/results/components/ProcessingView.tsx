import { AlertTriangle } from 'lucide-react'
import { Button, Card } from '@/components/ui'
import type { ProcessingLogEntry } from '@/features/results/types'

interface ProcessingViewProps {
  progress: number
  message: string
  eta: string
  logs: ProcessingLogEntry[]
  onCancel: () => void
}

export function ProcessingView({ progress, message, eta, logs, onCancel }: ProcessingViewProps) {
  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative h-10 w-10 rounded-full border border-primary-500/60">
          <span className="absolute inset-0 animate-ping rounded-full border border-primary-500/30" />
          <span className="absolute inset-2 rounded-full bg-primary-500/50" />
        </div>
        <div>
          <p className="text-sm font-medium text-neutral-100">{message}</p>
          <p className="text-xs text-neutral-400">Tempo restante estimado: {eta}</p>
        </div>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-neutral-800">
        <div className="h-full rounded-full bg-primary-500 transition-[width] duration-500" style={{ width: `${progress}%` }} />
      </div>
      <p className="text-sm text-neutral-300">{progress}%</p>

      <details className="rounded-lg border border-neutral-800 bg-neutral-950 p-3">
        <summary className="cursor-pointer text-sm text-neutral-200">Ver log detalhado</summary>
        <div className="mt-2 space-y-1 text-xs text-neutral-400">
          {logs.map((log, index) => (
            <p key={`${log.timestamp}-${index}`} className={index === logs.length - 1 ? 'text-primary-300' : ''}>
              [{log.timestamp}] {log.message}
            </p>
          ))}
        </div>
      </details>

      <Button variant="danger" onClick={onCancel}>
        <AlertTriangle className="mr-2 h-4 w-4" />
        Cancelar processamento
      </Button>
    </Card>
  )
}
