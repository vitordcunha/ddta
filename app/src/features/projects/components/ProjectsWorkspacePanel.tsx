import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Grid3X3, List } from 'lucide-react'
import { Button } from '@/components/ui'
import {
  CreateProjectModal,
  DeleteProjectModal,
  ProjectEmptyState,
  ProjectGrid,
  useProjects,
} from '@/features/projects'
import { useDebounce } from '@/hooks/useDebounce'
import type { Project } from '@/types/project'

export function ProjectsWorkspacePanel() {
  const { projects, createProject, updateProject, deleteProject } = useProjects()
  const [, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)

  const debouncedQuery = useDebounce(query, 300)
  const filteredProjects = useMemo(() => {
    if (!debouncedQuery.trim()) return projects
    return projects.filter((p) => p.name.toLowerCase().includes(debouncedQuery.toLowerCase()))
  }, [debouncedQuery, projects])

  const closeCreateModal = () => {
    setIsCreateModalOpen(false)
    setEditingProject(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[1.2px] text-neutral-500">Biblioteca</p>
          <p className="mt-0.5 text-sm text-[#898989]">{projects.length} projetos</p>
        </div>
        <Button size="sm" onClick={() => setIsCreateModalOpen(true)}>
          Novo projeto
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome"
          className="input-base flex-1"
        />
        <div className="inline-flex shrink-0 rounded-full border border-[#2e2e2e] bg-[#0f0f0f] p-1">
          <Button
            variant={view === 'grid' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setView('grid')}
            aria-label="Visualizacao em grade"
          >
            <Grid3X3 className="size-4" />
          </Button>
          <Button
            variant={view === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setView('list')}
            aria-label="Visualizacao em lista"
          >
            <List className="size-4" />
          </Button>
        </div>
      </div>

      {filteredProjects.length === 0 ? (
        <ProjectEmptyState onCreate={() => setIsCreateModalOpen(true)} />
      ) : (
        <ProjectGrid
          projects={filteredProjects}
          view={view}
          onEdit={(project) => {
            setEditingProject(project)
            setIsCreateModalOpen(true)
          }}
          onDelete={(project) => setProjectToDelete(project)}
        />
      )}

      <CreateProjectModal
        key={`${editingProject?.id ?? 'new'}-${isCreateModalOpen ? 'open' : 'closed'}`}
        open={isCreateModalOpen}
        onOpenChange={closeCreateModal}
        project={editingProject}
        onSubmit={async ({ name, description }) => {
          if (editingProject) {
            updateProject(editingProject.id, { name, description })
            return
          }
          const created = await createProject({ name, description })
          setSearchParams(
            (prev) => {
              const n = new URLSearchParams(prev)
              n.set('panel', 'plan')
              n.set('project', created.id)
              return n
            },
            { replace: true },
          )
        }}
      />
      <DeleteProjectModal
        open={Boolean(projectToDelete)}
        project={projectToDelete}
        onOpenChange={(open) => {
          if (!open) setProjectToDelete(null)
        }}
        onConfirm={() => {
          if (projectToDelete) {
            deleteProject(projectToDelete.id)
            setProjectToDelete(null)
          }
        }}
      />
    </div>
  )
}
