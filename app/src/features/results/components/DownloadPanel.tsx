import { useState } from 'react'
import { Download, FileArchive, FileText, Mountain, Trees } from 'lucide-react'
import { Badge, Button, Card } from '@/components/ui'
import { mockResultAssets } from '@/features/results/mocks/completedProject'

const products = [
  { id: 'orthophoto', name: 'Ortomosaico', description: 'Imagem aerea georreferenciada', format: mockResultAssets.orthophoto.format, size: mockResultAssets.orthophoto.size, icon: Trees },
  { id: 'dsm', name: 'MDS', description: 'Modelo Digital de Superficie', format: mockResultAssets.dsm.format, size: mockResultAssets.dsm.size, icon: Mountain },
  { id: 'dtm', name: 'MDT', description: 'Modelo Digital de Terreno', format: mockResultAssets.dtm.format, size: mockResultAssets.dtm.size, icon: Mountain },
  { id: 'point-cloud', name: 'Nuvem de Pontos', description: 'Para AutoCAD Civil e software BIM', format: mockResultAssets.pointCloud.format, size: mockResultAssets.pointCloud.size, icon: FileArchive },
  { id: 'contours', name: 'Curvas de Nivel', description: 'Curvas vetoriais de elevacao', format: mockResultAssets.contours.format, size: mockResultAssets.contours.size, icon: Trees },
  { id: 'report', name: 'Relatorio de Qualidade', description: 'Resumo tecnico de acuracia', format: mockResultAssets.report.format, size: mockResultAssets.report.size, icon: FileText },
]

export function DownloadPanel() {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [doneIds, setDoneIds] = useState<string[]>([])

  const onDownload = async (id: string) => {
    setLoadingId(id)
    await new Promise((resolve) => setTimeout(resolve, 800))
    setLoadingId(null)
    setDoneIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }

  return (
    <Card className="space-y-3">
      <h3 className="text-base font-semibold text-neutral-100">Produtos gerados</h3>
      <div className="space-y-2">
        {products.map((product) => {
          const Icon = product.icon
          const done = doneIds.includes(product.id)
          const loading = loadingId === product.id
          return (
            <div key={product.id} className="rounded-xl border border-neutral-800 bg-neutral-950 p-3 transition hover:border-primary-500/40">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <Icon className="mt-0.5 h-4 w-4 text-primary-300" />
                  <div>
                    <p className="text-sm font-medium text-neutral-100">{product.name}</p>
                    <p className="text-xs text-neutral-400">{product.description}</p>
                    <div className="mt-2 flex gap-1">
                      <Badge variant="info">{product.format}</Badge>
                      <Badge variant="created">{product.size}</Badge>
                    </div>
                  </div>
                </div>
                <Button size="sm" variant={done ? 'secondary' : 'outline'} loading={loading} onClick={() => void onDownload(product.id)}>
                  <Download className="mr-1 h-3.5 w-3.5" />
                  {done ? 'Baixado' : 'Baixar'}
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
