import { useMemo, useState } from 'react'
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

export function DashboardPage() {
  const { projects, createProject, updateProject, deleteProject } = useProjects()
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)

  const debouncedQuery = useDebounce(query, 300)
  const filteredProjects = useMemo(() => {
    if (!debouncedQuery.trim()) {
      return projects
    }
    return projects.filter((project) => project.name.toLowerCase().includes(debouncedQuery.toLowerCase()))
  }, [debouncedQuery, projects])

  const closeCreateModal = () => {
    setIsCreateModalOpen(false)
    setEditingProject(null)
  }

  return (
    <section className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Projetos</h2>
          <p className="text-sm text-neutral-400">{projects.length} projetos</p>
        </div>
        <Button size="sm" onClick={() => setIsCreateModalOpen(true)}>
          Novo Projeto
        </Button>
      </div>

      <div className="flex flex-col gap-3 md:flex-row">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por nome"
          className="input-base flex-1"
        />
        <div className="inline-flex rounded-full border border-neutral-800 bg-neutral-950 p-1">
          <Button variant={view === 'grid' ? 'secondary' : 'ghost'} size="sm" onClick={() => setView('grid')} aria-label="Visualizacao em grade">
            <Grid3X3 className="size-4" />
          </Button>
          <Button variant={view === 'list' ? 'secondary' : 'ghost'} size="sm" onClick={() => setView('list')} aria-label="Visualizacao em lista">
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
        onSubmit={({ name, description }) => {
          if (editingProject) {
            updateProject(editingProject.id, { name, description })
            return
          }
          createProject({ name, description })
        }}
      />
      <DeleteProjectModal
        open={Boolean(projectToDelete)}
        project={projectToDelete}
        onOpenChange={(open) => {
          if (!open) {
            setProjectToDelete(null)
          }
        }}
        onConfirm={() => {
          if (projectToDelete) {
            deleteProject(projectToDelete.id)
            setProjectToDelete(null)
          }
        }}
      />
    </section>
  )
}
