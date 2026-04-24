import { Card } from '@/components/ui'
import type { CompletedProjectStats } from '@/features/results/types'

interface ProcessingStatsGridProps {
  stats: CompletedProjectStats
}

function toMillions(value: number) {
  return `${(value / 1_000_000).toFixed(1).replace('.', ',')} M`
}

export function ProcessingStatsGrid({ stats }: ProcessingStatsGridProps) {
  const hours = Math.floor(stats.processingTimeMinutes / 60)
  const minutes = stats.processingTimeMinutes % 60

  const items = [
    { label: 'GSD', value: `${stats.gsdCmPx.toFixed(1).replace('.', ',')} cm/px` },
    { label: 'Area coberta', value: `${stats.areaHa.toFixed(2).replace('.', ',')} ha` },
    { label: 'Imagens processadas', value: String(stats.imageCount) },
    { label: 'Pontos na nuvem', value: toMillions(stats.pointCount) },
    { label: 'Resolucao ortomosaico', value: `${stats.orthophotoResolutionCmPx.toFixed(1).replace('.', ',')} cm/px` },
    { label: 'Tempo de processamento', value: `${hours} h ${String(minutes).padStart(2, '0')} min` },
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
