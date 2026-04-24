import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { projectsService } from '@/services/projectsService'
import type { CreateProjectData, Project } from '@/types/project'

export type UseProjectsReturn = {
  projects: Project[]
  isLoading: boolean
  createProject: (data: CreateProjectData) => Project
  updateProject: (id: string, data: Partial<Project>) => void
  deleteProject: (id: string) => void
  getProject: (id: string) => Project | undefined
}

export function useProjects(): UseProjectsReturn {
  const queryClient = useQueryClient()
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsService.getAll,
  })

  const createMutation = useMutation({
    mutationFn: projectsService.create,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Project> }) => projectsService.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: projectsService.remove,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })

  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }, [projects])

  const createProject = (data: CreateProjectData) => {
    const optimisticProject: Project = {
      id: crypto.randomUUID(),
      name: data.name,
      description: data.description ?? '',
      status: 'created',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      flightPlan: null,
      imageCount: 0,
      assets: null,
    }
    createMutation.mutate(data)
    return optimisticProject
  }

  const updateProject = (id: string, data: Partial<Project>) => {
    updateMutation.mutate({ id, payload: data })
  }

  const deleteProject = (id: string) => {
    deleteMutation.mutate(id)
  }

  const getProject = (id: string) => sortedProjects.find((project) => project.id === id)

  return {
    projects: sortedProjects,
    isLoading,
    createProject,
    updateProject,
    deleteProject,
    getProject,
  }
}
