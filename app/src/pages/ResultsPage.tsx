import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Badge, Card } from '@/components/ui'
import { DownloadPanel } from '@/features/results/components/DownloadPanel'
import { LayerSelector } from '@/features/results/components/LayerSelector'
import { OpacityControl } from '@/features/results/components/OpacityControl'
import { PointCloudViewer } from '@/features/results/components/PointCloudViewer'
import { ProcessingStatsGrid } from '@/features/results/components/ProcessingStatsGrid'
import { ProcessingView } from '@/features/results/components/ProcessingView'
import { ResultsLayout } from '@/features/results/components/ResultsLayout'
import { ResultsMapContainer } from '@/features/results/components/ResultsMapContainer'
import { StartProcessingPanel } from '@/features/results/components/StartProcessingPanel'
import { useProjectStatus } from '@/features/results/hooks/useProjectStatus'
import { completedProjectStats } from '@/features/results/mocks/completedProject'
import type { ProcessingPreset, ResultLayerId } from '@/features/results/types'
import { useProjects } from '@/features/projects/hooks/useProjects'

export function ResultsPage() {
  const { id = '' } = useParams()
  const { getProject } = useProjects()
  const project = getProject(id)
  const initialStatus = project?.status === 'processing' || project?.status === 'completed' ? project.status : 'uploading'

  const { status, progress, message, eta, logs, startProcessing, cancelProcessing } = useProjectStatus(initialStatus)
  const [activeLayer, setActiveLayer] = useState<ResultLayerId>('orthophoto')
  const [opacity, setOpacity] = useState(85)
  const [preset, setPreset] = useState<ProcessingPreset>('standard')

  const currentBadge = useMemo(() => {
    if (status === 'completed') return <Badge variant="success">Concluido</Badge>
    if (status === 'processing') return <Badge variant="processing">Processando</Badge>
    if (status === 'failed') return <Badge variant="error">Falhou</Badge>
    return <Badge variant="uploading">Aguardando processamento</Badge>
  }, [status])

  const mapSection = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <LayerSelector activeLayer={activeLayer} onChange={setActiveLayer} />
        <OpacityControl opacity={opacity} onChange={setOpacity} />
      </div>
      <ResultsMapContainer activeLayer={activeLayer} opacity={opacity} onOpacityChange={setOpacity} />
    </div>
  )

  const panelSection = (
    <>
      <Card className="space-y-2">
        <p className="text-sm text-neutral-400">Status do projeto</p>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-neutral-100">{project?.name ?? 'Projeto de mapeamento'}</h3>
          {currentBadge}
        </div>
      </Card>

      {status === 'uploading' ? <StartProcessingPanel selectedPreset={preset} onSelectPreset={setPreset} onStart={startProcessing} /> : null}

      {status === 'processing' ? <ProcessingView progress={progress} message={message} eta={eta} logs={logs} onCancel={cancelProcessing} /> : null}

      {status === 'completed' ? (
        <>
          <ProcessingStatsGrid stats={completedProjectStats} />
          <DownloadPanel />
          <PointCloudViewer />
        </>
      ) : null}
    </>
  )

  return <ResultsLayout map={mapSection} panel={panelSection} />
}
