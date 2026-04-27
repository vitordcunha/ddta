import { useQuery } from '@tanstack/react-query'
import { SESSION_STABLE } from '@/lib/queryClient'
import { http } from '@/services/http'
import type { ApiDroneModel } from '@/features/flight-planner/types/droneModelApi'

export const droneModelsQueryKey = ['drone-models'] as const

export async function fetchDroneModels(): Promise<ApiDroneModel[]> {
  const { data } = await http.get<ApiDroneModel[]>('/drone-models')
  return data
}

export function useDroneModelsQuery() {
  return useQuery({
    queryKey: droneModelsQueryKey,
    queryFn: fetchDroneModels,
    ...SESSION_STABLE,
  })
}
