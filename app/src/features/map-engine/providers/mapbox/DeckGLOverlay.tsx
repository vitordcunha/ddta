import { useEffect, useRef } from 'react'
import { MapboxOverlay } from '@deck.gl/mapbox'
import type { Layer } from '@deck.gl/core'
import type { Map as MapboxMap } from 'mapbox-gl'

type DeckGLOverlayProps = {
  map: MapboxMap | null
  layers: Layer[]
  onWaypointClick?: (waypointId: string) => void
  /** Clique em área do deck que não é marcador de waypoint (ex.: mapa, rota, frustum). */
  onWaypointPickMiss?: () => void
}

export function DeckGLOverlay({
  map,
  layers,
  onWaypointClick,
  onWaypointPickMiss,
}: DeckGLOverlayProps) {
  const overlayRef = useRef<MapboxOverlay | null>(null)

  useEffect(() => {
    if (!map) return
    const overlay = new MapboxOverlay({
      interleaved: true,
      layers: [],
    })
    map.addControl(overlay)
    overlayRef.current = overlay
    return () => {
      map.removeControl(overlay)
      overlay.finalize()
      overlayRef.current = null
    }
  }, [map])

  useEffect(() => {
    overlayRef.current?.setProps({
      layers,
      onClick: (info) => {
        if (info.layer?.id === 'waypoints') {
          const obj = info.object as { id?: string } | undefined
          if (obj && typeof obj.id === 'string') {
            onWaypointClick?.(obj.id)
            return true
          }
        }
        onWaypointPickMiss?.()
        return false
      },
    })
  }, [layers, onWaypointClick, onWaypointPickMiss])

  return null
}
