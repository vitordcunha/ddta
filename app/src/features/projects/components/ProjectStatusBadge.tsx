import { Badge } from '@/components/ui'
import type { ProjectStatus } from '@/types/project'

const statusMap: Record<ProjectStatus, { variant: 'created' | 'uploading' | 'processing' | 'completed' | 'failed'; label: string }> = {
  created: { variant: 'created', label: 'Aguardando' },
  uploading: { variant: 'uploading', label: 'Enviando imagens' },
  processing: { variant: 'processing', label: 'Processando' },
  completed: { variant: 'completed', label: 'Concluido' },
  failed: { variant: 'failed', label: 'Erro' },
}

type ProjectStatusBadgeProps = {
  status: ProjectStatus
}

export function ProjectStatusBadge({ status }: ProjectStatusBadgeProps) {
  const config = statusMap[status]
  return <Badge variant={config.variant}>{config.label}</Badge>
}
