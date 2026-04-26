import { useQuery } from '@tanstack/react-query'
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
    staleTime: 5 * 60_000,
  })
}
