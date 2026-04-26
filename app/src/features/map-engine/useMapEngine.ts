import { useContext } from 'react'
import { MapEngineContext, type MapEngineContextValue } from '@/features/map-engine/MapEngineContext'

export function useMapEngine(): MapEngineContextValue {
  const ctx = useContext(MapEngineContext)
  if (!ctx) {
    throw new Error('useMapEngine must be used within MapEngineProvider')
  }
  return ctx
}
