import { Badge } from '@/components/ui'
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
}

export function ProjectStatusBadge({ status }: ProjectStatusBadgeProps) {
  const config = status ? statusMap[status] : undefined
  const safeConfig = config ?? { variant: 'failed' as const, label: 'Status desconhecido' }
  return <Badge variant={safeConfig.variant}>{safeConfig.label}</Badge>
}
