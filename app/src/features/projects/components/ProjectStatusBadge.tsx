import { Badge } from '@/components/ui'
import { ProgressRing } from '@/components/ui/ProgressRing'
import type { ProjectStatus } from '@/types/project'

const statusMap: Record<ProjectStatus, { variant: 'created' | 'uploading' | 'processing' | 'completed' | 'failed'; label: string }> = {
  draft: { variant: 'created', label: 'Rascunho' },
  created: { variant: 'created', label: 'Aguardando' },
  uploading: { variant: 'uploading', label: 'Enviando imagens' },
  processing: { variant: 'processing', label: 'Processando' },
  completed: { variant: 'completed', label: 'Concluido' },
  failed: { variant: 'failed', label: 'Erro' },
}

type ProjectStatusBadgeProps = {
  status?: ProjectStatus | null
  /** 0–100 progress for indeterminate ring when processing. */
  progress?: number
}

export function ProjectStatusBadge({ status, progress }: ProjectStatusBadgeProps) {
  if (status === 'processing') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2 py-0.5 text-xs text-[#3ecf8e]">
        <ProgressRing
          size={16}
          strokeWidth={2}
          progress={typeof progress === 'number' ? progress : undefined}
        />
        {typeof progress === 'number' && progress > 0
          ? `${Math.round(progress)}%`
          : 'Processando'}
      </span>
    )
  }

  const config = status ? statusMap[status] : undefined
  const safeConfig = config ?? { variant: 'failed' as const, label: 'Status desconhecido' }
  return <Badge variant={safeConfig.variant}>{safeConfig.label}</Badge>
}
