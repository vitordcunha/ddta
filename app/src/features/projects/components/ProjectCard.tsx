import { memo, Suspense, useState } from 'react'
import { Boxes, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, Card, CardBody, CardFooter, CardHeader } from '@/components/ui'
import { ProjectStatusBadge } from '@/features/projects/components/ProjectStatusBadge'
import { SparseCloudViewer } from '@/features/sparse-cloud'
import type { Project } from '@/types/project'

type ProjectCardProps = {
  project: Project
  onEdit: (project: Project) => void
  onDelete: (project: Project) => void
}

export const ProjectCard = memo(function ProjectCard({ project, onEdit, onDelete }: ProjectCardProps) {
  const [cloudOpen, setCloudOpen] = useState(false)
  const parsedDate = new Date(project.createdAt)
  const createdAt = Number.isNaN(parsedDate.getTime()) ? 'Data indisponivel' : parsedDate.toLocaleDateString('pt-BR')

  return (
    <>
      <Card className="flex h-full flex-col transition-colors hover:border-neutral-700">
        <div className="mb-3 h-28 rounded-lg border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-800" />
        <CardHeader className="mb-2 flex items-center justify-between">
          <ProjectStatusBadge status={project.status} />
          <div className="flex items-center gap-2">
            {project.sparseCloudAvailable && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCloudOpen(true)}
                aria-label="Ver nuvem esparsa 3D"
                title="Nuvem esparsa disponível"
              >
                <Boxes className="size-4 text-[#3ecf8e]" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => onEdit(project)} aria-label={`Editar projeto ${project.name}`}>
              <Pencil className="size-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDelete(project)} aria-label={`Excluir projeto ${project.name}`}>
              <Trash2 className="size-4 text-danger-300" />
            </Button>
            <MoreHorizontal className="size-4 text-neutral-500" />
          </div>
        </CardHeader>
        <CardBody className="space-y-1">
          <h3 className="line-clamp-1 font-medium">{project.name}</h3>
          <p className="line-clamp-2 text-sm text-neutral-400">{project.description || 'Sem descricao'}</p>
          <Link
            to={`/?project=${project.id}&panel=plan`}
            className="inline-flex pt-2 text-sm text-[#00c573] underline-offset-4 hover:text-[#3ecf8e] hover:underline"
          >
            Abrir planejador
          </Link>
        </CardBody>
        <CardFooter className="mt-auto space-y-2 text-sm text-neutral-400">
          <p>{createdAt}</p>
          <p>{project.imageCount} imagens</p>
        </CardFooter>
      </Card>

      {cloudOpen && (
        <Suspense fallback={null}>
          <SparseCloudViewer
            open
            onOpenChange={(open) => { if (!open) setCloudOpen(false) }}
            projectId={project.id}
            projectName={project.name}
          />
        </Suspense>
      )}
    </>
  )
})
