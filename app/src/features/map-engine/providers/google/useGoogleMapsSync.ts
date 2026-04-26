import { useEffect, useRef } from 'react'
import { useMapEngine } from '@/features/map-engine/useMapEngine'

/**
 * Mantém `center`/`zoom` do MapEngineContext alinhados ao mapa Google e vice-versa
 * (troca de provedor, foco externo, etc.).
 */
export function useGoogleMapsSync(map: google.maps.Map | null) {
  const { center, zoom, setCenterZoom } = useMapEngine()
  const applyingFromContext = useRef(false)

  useEffect(() => {
    if (!map) return
    const syncFromMap = () => {
      if (applyingFromContext.current) return
      const c = map.getCenter()
      if (!c) return
      setCenterZoom([c.lat(), c.lng()], map.getZoom() ?? zoom)
    }
    const drag = map.addListener('dragend', syncFromMap)
    const zoomListener = map.addListener('zoom_changed', syncFromMap)
    return () => {
      drag.remove()
      zoomListener.remove()
    }
  }, [map, setCenterZoom, zoom])

  useEffect(() => {
    if (!map) return
    const mc = map.getCenter()
    const z = map.getZoom() ?? zoom
    if (!mc) return
    const sameLat = Math.abs(mc.lat() - center[0]) < 1e-7
    const sameLng = Math.abs(mc.lng() - center[1]) < 1e-7
    if (sameLat && sameLng && z === zoom) return
    applyingFromContext.current = true
    map.setCenter({ lat: center[0], lng: center[1] })
    map.setZoom(zoom)
    const t = window.setTimeout(() => {
      applyingFromContext.current = false
    }, 80)
    return () => window.clearTimeout(t)
  }, [center, zoom, map])
}
