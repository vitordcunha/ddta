import { Pencil, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, Card } from '@/components/ui'
import { ProjectStatusBadge } from '@/features/projects/components/ProjectStatusBadge'
import type { Project } from '@/types/project'

type ProjectListItemProps = {
  project: Project
  onEdit: (project: Project) => void
  onDelete: (project: Project) => void
}

export function ProjectListItem({ project, onEdit, onDelete }: ProjectListItemProps) {
  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-medium">{project.name}</h3>
          <p className="text-sm text-neutral-400">{project.imageCount} imagens</p>
          <Link
            to={`/?project=${project.id}&panel=plan`}
            className="text-sm text-[#00c573] underline-offset-4 hover:text-[#3ecf8e] hover:underline"
          >
            Abrir planejador
          </Link>
        </div>
        <ProjectStatusBadge status={project.status} />
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" className="flex-1" onClick={() => onEdit(project)}>
          <Pencil className="mr-2 size-4" />
          Editar
        </Button>
        <Button variant="danger" size="sm" className="flex-1" onClick={() => onDelete(project)}>
          <Trash2 className="mr-2 size-4" />
          Excluir
        </Button>
      </div>
    </Card>
  )
}
