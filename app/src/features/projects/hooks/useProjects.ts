import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { clearFlightPlanDraft } from '@/features/flight-planner/utils/flightPlanDraftStorage'
import type { PersistedFlightPlan } from '@/features/flight-planner/stores/useFlightStore'
import { projectsService } from '@/services/projectsService'
import type { CreateProjectData, Project } from '@/types/project'

export type UseProjectsReturn = {
  projects: Project[]
  isLoading: boolean
  createProject: (data: CreateProjectData) => Promise<Project>
  updateProject: (id: string, data: Partial<Project>) => void
  saveFlightPlan: (id: string, plan: PersistedFlightPlan) => Promise<Project>
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
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success(`Projeto \"${data.name}\" criado.`)
    },
    onError: () => {
      toast.error('Nao foi possivel criar o projeto.')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Project> }) => projectsService.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Projeto atualizado.')
    },
    onError: () => {
      toast.error('Nao foi possivel atualizar o projeto.')
    },
  })

  const saveFlightPlanMutation = useMutation({
    mutationFn: ({ id, plan }: { id: string; plan: PersistedFlightPlan }) => projectsService.saveFlightPlan(id, plan),
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
      clearFlightPlanDraft(id)
      toast.success('Plano de voo salvo no servidor.')
    },
    onError: () => {
      toast.error('Nao foi possivel salvar o plano. Tente novamente.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: projectsService.remove,
    onSuccess: (_void, id) => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
      clearFlightPlanDraft(id)
      toast.success('Projeto excluido.')
    },
    onError: () => {
      toast.error('Nao foi possivel excluir o projeto.')
    },
  })

  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }, [projects])

  const createProject = async (data: CreateProjectData) => {
    return createMutation.mutateAsync(data)
  }

  const updateProject = (id: string, data: Partial<Project>) => {
    updateMutation.mutate({ id, payload: data })
  }

  const deleteProject = (id: string) => {
    deleteMutation.mutate(id)
  }

  const saveFlightPlan = (id: string, plan: PersistedFlightPlan) => {
    return saveFlightPlanMutation.mutateAsync({ id, plan })
  }

  const getProject = (id: string) => sortedProjects.find((project) => project.id === id)

  return {
    projects: sortedProjects,
    isLoading,
    createProject,
    updateProject,
    saveFlightPlan,
    deleteProject,
    getProject,
  }
}
