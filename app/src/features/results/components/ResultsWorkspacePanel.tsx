import { useMemo, useState } from 'react'
import { Badge, Card } from '@/components/ui'
import { DownloadPanel } from '@/features/results/components/DownloadPanel'
import { LayerSelector } from '@/features/results/components/LayerSelector'
import { PointCloudViewer } from '@/features/results/components/PointCloudViewer'
import { ProcessingStatsGrid } from '@/features/results/components/ProcessingStatsGrid'
import { ProcessingView } from '@/features/results/components/ProcessingView'
import { StartProcessingPanel } from '@/features/results/components/StartProcessingPanel'
import { useProjectStatus } from '@/features/results/hooks/useProjectStatus'
import { completedProjectStats } from '@/features/results/mocks/completedProject'
import { useResultsViewStore } from '@/features/results/stores/useResultsViewStore'
import type { ProcessingPreset } from '@/features/results/types'
import { useProjects } from '@/features/projects/hooks/useProjects'

type ResultsWorkspacePanelProps = {
  projectId: string
}

export function ResultsWorkspacePanel({ projectId }: ResultsWorkspacePanelProps) {
  const { getProject } = useProjects()
  const project = getProject(projectId)
  const initialStatus =
    project?.status === 'processing' || project?.status === 'completed' ? project.status : 'uploading'

  const { status, progress, message, eta, logs, startProcessing, cancelProcessing } = useProjectStatus(
    projectId,
    initialStatus,
  )
  const [preset, setPreset] = useState<ProcessingPreset>('standard')
  const activeLayer = useResultsViewStore((s) => s.activeLayer)
  const setActiveLayer = useResultsViewStore((s) => s.setActiveLayer)

  const currentBadge = useMemo(() => {
    if (status === 'completed') return <Badge variant="success">Concluido</Badge>
    if (status === 'processing') return <Badge variant="processing">Processando</Badge>
    if (status === 'failed') return <Badge variant="error">Falhou</Badge>
    return <Badge variant="uploading">Aguardando processamento</Badge>
  }, [status])

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[1.2px] text-neutral-500">Camada ativa</p>
        <LayerSelector activeLayer={activeLayer} onChange={setActiveLayer} />
        <p className="text-xs text-neutral-500">Ajuste a opacidade no controle vertical sobre o mapa.</p>
      </div>

      <Card className="space-y-2 border-[#2e2e2e] bg-[#171717]/80">
        <p className="text-sm text-neutral-400">Status do projeto</p>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base text-neutral-100">{project?.name ?? 'Projeto de mapeamento'}</h3>
          {currentBadge}
        </div>
      </Card>

      {status === 'uploading' ? (
        <StartProcessingPanel selectedPreset={preset} onSelectPreset={setPreset} onStart={() => void startProcessing()} />
      ) : null}

      {status === 'processing' ? (
        <ProcessingView
          progress={progress}
          message={message}
          eta={eta}
          logs={logs}
          onCancel={() => void cancelProcessing()}
        />
      ) : null}

      {status === 'completed' ? (
        <>
          <ProcessingStatsGrid stats={completedProjectStats} />
          <DownloadPanel />
          <PointCloudViewer />
        </>
      ) : null}
    </div>
  )
}
