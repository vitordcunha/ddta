import { AnimatePresence, motion } from 'framer-motion'
import { ProjectCard } from '@/features/projects/components/ProjectCard'
import { ProjectListItem } from '@/features/projects/components/ProjectListItem'
import type { Project } from '@/types/project'

type ProjectGridProps = {
  projects: Project[]
  view: 'grid' | 'list'
  onEdit: (project: Project) => void
  onDelete: (project: Project) => void
}

export function ProjectGrid({ projects, view, onEdit, onDelete }: ProjectGridProps) {
  if (view === 'list') {
    return (
      <div className="flex flex-col gap-3">
        <AnimatePresence mode="popLayout">
          {projects.map((project) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <ProjectListItem project={project} onEdit={onEdit} onDelete={onDelete} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 lg:gap-4">
      <AnimatePresence mode="popLayout">
        {projects.map((project, index) => (
          <motion.div
            key={project.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, delay: index * 0.04 }}
          >
            <ProjectCard project={project} onEdit={onEdit} onDelete={onDelete} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
