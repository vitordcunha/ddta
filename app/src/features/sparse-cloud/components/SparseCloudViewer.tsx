import { useMemo, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import DeckGL from '@deck.gl/react'
import { COORDINATE_SYSTEM, OrbitView } from '@deck.gl/core'
import { PointCloudLayer } from '@deck.gl/layers'
import { useQuery } from '@tanstack/react-query'
import type { FeatureCollection, Point } from 'geojson'
import { AlertCircle, Loader2, Minus, Plus, X } from 'lucide-react'
import { projectsService } from '@/services/projectsService'
import { detectDeviceTier } from '@/features/map-engine/utils/detectDeviceTier'
import { getSparseCloudMaxPoints } from '@/features/map-engine/utils/getSparseCloudMaxPoints'

type PcDatum = {
  position: [number, number, number]
  color: [number, number, number]
}

type SparseCloudProperties = { color?: number[] | null }

function buildPointCloud(geojson: FeatureCollection<Point, SparseCloudProperties>): {
  points: PcDatum[]
  zoom: number
} {
  const features = geojson.features.filter(
    (f) => f.geometry?.type === 'Point' && f.geometry.coordinates.length >= 2,
  )
  if (!features.length) return { points: [], zoom: 5 }

  let sumLon = 0
  let sumLat = 0
  let sumAlt = 0
  for (const f of features) {
    sumLon += f.geometry.coordinates[0]
    sumLat += f.geometry.coordinates[1]
    sumAlt += f.geometry.coordinates[2] ?? 0
  }
  const n = features.length
  const lon0 = sumLon / n
  const lat0 = sumLat / n
  const alt0 = sumAlt / n
  const cosLat = Math.cos((lat0 * Math.PI) / 180)

  let maxExtent = 1
  const points: PcDatum[] = features.map((f) => {
    const x = (f.geometry.coordinates[0] - lon0) * 111320 * cosLat
    const y = (f.geometry.coordinates[1] - lat0) * 111320
    const z = (f.geometry.coordinates[2] ?? 0) - alt0
    maxExtent = Math.max(maxExtent, Math.abs(x), Math.abs(y))
    const raw = f.properties?.color
    const color: [number, number, number] =
      Array.isArray(raw) && raw.length >= 3
        ? [raw[0], raw[1], raw[2]]
        : [128, 128, 128]
    return { position: [x, y, z], color }
  })

  // zoom: at deck.gl zoom N, 1 world unit = 2^N pixels.
  // We want the full extent (2 * maxExtent) to span ~70% of a ~800px viewport.
  const zoom = Math.log2((800 * 0.35) / maxExtent)

  return { points, zoom }
}

export type SparseCloudViewerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  projectName: string
}

export function SparseCloudViewer({
  open,
  onOpenChange,
  projectId,
  projectName,
}: SparseCloudViewerProps) {
  const [pointSize, setPointSize] = useState(2)

  const maxPoints = useMemo(() => getSparseCloudMaxPoints(detectDeviceTier(), true), [])

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['sparse-cloud', projectId, maxPoints],
    queryFn: () =>
      projectsService.getSparseCloudGeoJson(projectId, { maxPoints }) as Promise<
        FeatureCollection<Point, SparseCloudProperties>
      >,
    enabled: open,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  const { points, zoom } = useMemo(
    () => (data ? buildPointCloud(data) : { points: [], zoom: 5 }),
    [data],
  )

  const layer = useMemo(
    () =>
      new PointCloudLayer<PcDatum>({
        id: 'sparse-cloud-3d',
        data: points,
        coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
        getPosition: (d) => d.position,
        getColor: (d) => [d.color[0], d.color[1], d.color[2], 255],
        pointSize,
        pickable: false,
      }),
    [points, pointSize],
  )

  const initialViewState = useMemo(
    () => ({
      target: [0, 0, 0] as [number, number, number],
      rotationX: 30,
      rotationOrbit: 30,
      zoom,
      minZoom: -10,
      maxZoom: 25,
    }),
    [zoom],
  )

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 bg-black/70 backdrop-blur-sm"
          style={{ zIndex: 200 }}
        />
        <Dialog.Content
          className="fixed inset-0 flex flex-col bg-[#0a0a0a] outline-none"
          style={{ zIndex: 201 }}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-white/[0.08] px-4 py-3">
            <div className="min-w-0">
              <Dialog.Title className="text-base font-semibold text-neutral-100">
                Nuvem Esparsa
              </Dialog.Title>
              <p className="truncate text-xs text-neutral-500">{projectName}</p>
            </div>

            <div className="flex items-center gap-3">
              {points.length > 0 && (
                <>
                  <span className="hidden text-xs text-neutral-500 sm:inline">
                    {points.length.toLocaleString('pt-BR')} pontos
                  </span>
                  <div className="h-4 w-px bg-white/[0.08]" />
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-neutral-500">Tamanho</span>
                    <button
                      type="button"
                      onClick={() => setPointSize((s) => Math.max(1, s - 1))}
                      disabled={pointSize <= 1}
                      aria-label="Diminuir tamanho do ponto"
                      className="flex size-7 items-center justify-center rounded text-neutral-400 transition-colors hover:bg-white/[0.06] hover:text-neutral-100 disabled:opacity-40"
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <span className="w-4 text-center font-mono text-xs text-neutral-200">
                      {pointSize}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPointSize((s) => Math.min(8, s + 1))}
                      disabled={pointSize >= 8}
                      aria-label="Aumentar tamanho do ponto"
                      className="flex size-7 items-center justify-center rounded text-neutral-400 transition-colors hover:bg-white/[0.06] hover:text-neutral-100 disabled:opacity-40"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                  <div className="h-4 w-px bg-white/[0.08]" />
                </>
              )}
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Fechar"
                  className="flex size-9 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-white/[0.06] hover:text-neutral-100"
                >
                  <X className="size-5" />
                </button>
              </Dialog.Close>
            </div>
          </div>

          {/* Canvas area */}
          <div className="relative flex-1 overflow-hidden">
            {isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <Loader2 className="size-8 animate-spin text-[#3ecf8e]" />
                <p className="text-sm text-neutral-400">Carregando nuvem esparsa...</p>
              </div>
            )}

            {!isLoading && error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <AlertCircle className="size-8 text-red-400" />
                <p className="text-sm text-neutral-400">Erro ao carregar a nuvem esparsa.</p>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="text-xs text-[#3ecf8e] transition-colors hover:text-[#00c573]"
                >
                  Tentar novamente
                </button>
              </div>
            )}

            {!isLoading && !error && data && points.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-sm text-neutral-500">Nenhum ponto encontrado.</p>
              </div>
            )}

            {points.length > 0 && (
              <DeckGL
                views={new OrbitView({ id: 'orbit' })}
                initialViewState={initialViewState}
                controller
                layers={[layer]}
                style={{ width: '100%', height: '100%' }}
              />
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t border-white/[0.04] px-4 py-2 text-center text-xs text-neutral-600">
            Arraste para rotacionar · Scroll para zoom · Shift+arraste para mover
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
