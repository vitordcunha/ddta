import { Card } from '@/components/ui'
import type { CompletedProjectStats } from '@/features/results/types'

interface ProcessingStatsGridProps {
  stats: CompletedProjectStats | null
}

function toMillions(value: number) {
  return `${(value / 1_000_000).toFixed(1).replace('.', ',')} M`
}

function fmt(value: number | undefined | null, format: (v: number) => string): string {
  return value != null ? format(value) : '—'
}

export function ProcessingStatsGrid({ stats }: ProcessingStatsGridProps) {
  const hours = stats ? Math.floor(stats.processingTimeMinutes / 60) : null
  const minutes = stats ? stats.processingTimeMinutes % 60 : null

  const items = [
    { label: 'GSD', value: fmt(stats?.gsdCmPx, (v) => `${v.toFixed(1).replace('.', ',')} cm/px`) },
    { label: 'Area coberta', value: fmt(stats?.areaHa, (v) => `${v.toFixed(2).replace('.', ',')} ha`) },
    { label: 'Imagens processadas', value: stats?.imageCount != null ? String(stats.imageCount) : '—' },
    { label: 'Pontos na nuvem', value: fmt(stats?.pointCount, toMillions) },
    { label: 'Resolucao ortomosaico', value: fmt(stats?.orthophotoResolutionCmPx, (v) => `${v.toFixed(1).replace('.', ',')} cm/px`) },
    {
      label: 'Tempo de processamento',
      value: hours != null && minutes != null ? `${hours} h ${String(minutes).padStart(2, '0')} min` : '—',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item) => (
        <Card key={item.label} className="bg-neutral-950 p-3">
          <p className="text-xs uppercase tracking-wide text-neutral-500">{item.label}</p>
          <p className="text-sm font-semibold text-neutral-100">{item.value}</p>
        </Card>
      ))}
    </div>
  )
}
