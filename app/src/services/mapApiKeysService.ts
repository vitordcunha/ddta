import { http } from '@/services/http'

export type MapApiKeysDto = {
  mapbox_api_key: string | null
  google_maps_api_key: string | null
}

export async function fetchMapApiKeys(): Promise<MapApiKeysDto> {
  const { data } = await http.get<MapApiKeysDto>('/settings/api-keys')
  return data
}

export async function updateMapApiKeys(payload: {
  mapbox_api_key?: string | null
  google_maps_api_key?: string | null
}): Promise<MapApiKeysDto> {
  const { data } = await http.put<MapApiKeysDto>('/settings/api-keys', payload)
  return data
}
