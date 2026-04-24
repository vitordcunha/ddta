import { useState } from 'react'
import { Box } from 'lucide-react'
import { Button, Card } from '@/components/ui'

export function PointCloudViewer() {
  const [enabled, setEnabled] = useState(false)

  return (
    <Card className="space-y-3">
      <h3 className="text-base font-semibold text-neutral-100">Nuvem de pontos</h3>
      {!enabled ? (
        <div className="rounded-xl border border-dashed border-neutral-700 bg-neutral-950 p-4 text-sm text-neutral-400">
          <p className="mb-3">Visualizador Potree carregado sob demanda.</p>
          <Button onClick={() => setEnabled(true)}>
            <Box className="mr-2 h-4 w-4" />
            Abrir visualizador
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-800">
          <iframe
            title="Potree Viewer"
            src="https://potree.org/potree/examples/showcase/vol_total/index.html"
            className="h-64 w-full bg-neutral-950"
            loading="lazy"
          />
        </div>
      )}
    </Card>
  )
}
