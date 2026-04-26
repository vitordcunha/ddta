import { useCallback, useEffect, useRef } from 'react'
import type { MapRef } from 'react-map-gl/mapbox'
import { useMapEngine } from '@/features/map-engine/useMapEngine'

type MoveEndEvent = {
  viewState: {
    latitude: number
    longitude: number
    zoom: number
  }
}

/**
 * Mantém `center`/`zoom` do MapEngineContext alinhados ao mapa Mapbox e vice-versa
 * (ex.: troca de provedor ou foco externo).
 */
export function useMapboxSync(mapRef: React.RefObject<MapRef | null>) {
  const { center, zoom, setCenterZoom } = useMapEngine()
  const applyingFromContext = useRef(false)

  const onMoveEnd = useCallback(
    (e: MoveEndEvent) => {
      if (applyingFromContext.current) return
      const { latitude, longitude, zoom: z } = e.viewState
      setCenterZoom([latitude, longitude], z)
    },
    [setCenterZoom],
  )

  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map) return
    const mc = map.getCenter()
    const z = map.getZoom()
    const sameLat = Math.abs(mc.lat - center[0]) < 1e-7
    const sameLng = Math.abs(mc.lng - center[1]) < 1e-7
    if (sameLat && sameLng && z === zoom) return
    applyingFromContext.current = true
    map.jumpTo({
      center: [center[1], center[0]],
      zoom,
    })
    const id = requestAnimationFrame(() => {
      applyingFromContext.current = false
    })
    return () => cancelAnimationFrame(id)
  }, [center, zoom, mapRef])

  return { onMoveEnd }
}
