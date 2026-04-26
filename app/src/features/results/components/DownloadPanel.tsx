import { useState } from 'react'
import { Download, FileArchive, FileText, Mountain, Trees } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Badge, Button, Card } from '@/components/ui'
import { projectsService } from '@/services/projectsService'

interface DownloadPanelProps {
  projectId: string
  assets: Record<string, string> | null
}

interface ProductDef {
  id: string
  name: string
  description: string
  patterns: string[]
  icon: LucideIcon
}

const PRODUCTS: ProductDef[] = [
  { id: 'orthophoto', name: 'Ortomosaico', description: 'Imagem aerea georreferenciada', patterns: ['odm_orthophoto.tif', 'orthophoto'], icon: Trees },
  { id: 'dsm', name: 'MDS', description: 'Modelo Digital de Superficie', patterns: ['dsm.tif'], icon: Mountain },
  { id: 'dtm', name: 'MDT', description: 'Modelo Digital de Terreno', patterns: ['dtm.tif'], icon: Mountain },
  { id: 'point-cloud', name: 'Nuvem de Pontos', description: 'Para AutoCAD Civil e software BIM', patterns: ['.laz', '.las', 'odm_georeferenced_model'], icon: FileArchive },
  { id: 'contours', name: 'Curvas de Nivel', description: 'Curvas vetoriais de elevacao', patterns: ['contours'], icon: Trees },
  { id: 'report', name: 'Relatorio de Qualidade', description: 'Resumo tecnico de acuracia', patterns: ['odm_report', 'report.pdf', 'quality_report'], icon: FileText },
]

function findAssetKey(assets: Record<string, string>, patterns: string[]): string | undefined {
  for (const key of Object.keys(assets)) {
    if (patterns.some((p) => key.toLowerCase().includes(p.toLowerCase()))) return key
  }
  return undefined
}

function formatExt(assetKey: string): string {
  const ext = assetKey.split('.').pop()?.toUpperCase()
  return ext ?? 'FILE'
}

export function DownloadPanel({ projectId, assets }: DownloadPanelProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [doneIds, setDoneIds] = useState<string[]>([])

  const onDownload = async (product: ProductDef) => {
    if (!assets) return
    const assetKey = findAssetKey(assets, product.patterns)
    if (!assetKey) return
    setLoadingId(product.id)
    try {
      await projectsService.downloadAsset(projectId, assetKey)
      setDoneIds((prev) => (prev.includes(product.id) ? prev : [...prev, product.id]))
    } catch {
      toast.error(`Nao foi possivel baixar ${product.name}. Tente novamente.`)
    } finally {
      setLoadingId(null)
    }
  }

  const visibleProducts = PRODUCTS.map((p) => ({
    ...p,
    assetKey: assets ? findAssetKey(assets, p.patterns) : undefined,
  })).filter((p) => p.assetKey !== undefined)

  if (!assets || visibleProducts.length === 0) {
    return (
      <Card className="space-y-3">
        <h3 className="text-base font-semibold text-neutral-100">Produtos gerados</h3>
        <p className="text-sm text-neutral-400">Nenhum produto disponivel para download.</p>
      </Card>
    )
  }

  return (
    <Card className="space-y-3">
      <h3 className="text-base font-semibold text-neutral-100">Produtos gerados</h3>
      <div className="space-y-2">
        {visibleProducts.map((product) => {
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
                      <Badge variant="info">{formatExt(product.assetKey!)}</Badge>
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={done ? 'secondary' : 'outline'}
                  loading={loading}
                  disabled={loading}
                  onClick={() => void onDownload(product)}
                >
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
