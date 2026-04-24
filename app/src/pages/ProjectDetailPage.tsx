import { Link, useParams } from 'react-router-dom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import { Badge } from '@/components/ui/Badge'
import { useProjects } from '@/features/projects/hooks/useProjects'

export function ProjectDetailPage() {
  const { id } = useParams()
  const { getProject } = useProjects()
  const project = getProject(id ?? '')
  const base = `/projects/${id}`
  const hasPlan = Boolean(project?.flightPlan)
  const hasUpload = (project?.imageCount ?? 0) > 0
  const hasResults = project?.status === 'completed'

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">{project?.name ?? 'Projeto'}</h2>
        <Badge variant={project?.status === 'completed' ? 'success' : project?.status === 'processing' ? 'processing' : 'info'}>
          {project?.status ?? 'created'}
        </Badge>
      </div>
      <Tabs defaultValue="plan">
        <TabsList>
          <TabsTrigger value="plan">Planejamento {hasPlan ? '✓' : ''}</TabsTrigger>
          <TabsTrigger value="upload">Upload {hasUpload ? '✓' : ''}</TabsTrigger>
          <TabsTrigger value="results">Resultados {hasResults ? '✓' : ''}</TabsTrigger>
        </TabsList>
        <TabsContent value="plan" className="mt-4 text-neutral-300">
          Hub do projeto pronto para fases seguintes.
        </TabsContent>
        <TabsContent value="upload" className="mt-4 text-neutral-300">
          Área de upload (placeholder).
        </TabsContent>
        <TabsContent value="results" className="mt-4 text-neutral-300">
          Área de resultados (placeholder).
        </TabsContent>
      </Tabs>
      <div className="flex flex-wrap gap-2">
        <Link to={`${base}/plan`} className="text-sm text-primary-500 underline-offset-4 hover:underline">
          Abrir planejador de voo
        </Link>
        <Link to={`${base}/upload`} className="text-sm text-neutral-300 underline-offset-4 hover:underline">
          Abrir upload
        </Link>
        <Link to={`${base}/results`} className="text-sm text-neutral-300 underline-offset-4 hover:underline">
          Abrir resultados
        </Link>
      </div>
    </section>
  )
}
