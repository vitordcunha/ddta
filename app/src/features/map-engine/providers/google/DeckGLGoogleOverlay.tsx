import { useEffect, useRef } from 'react'
import { GoogleMapsOverlay } from '@deck.gl/google-maps'
import type { Layer } from '@deck.gl/core'

type DeckGLGoogleOverlayProps = {
  map: google.maps.Map | null
  /** Interleaved WebGL exige mapa vetorial com `mapId`; sem mapId use false (canvas sobreposto). */
  interleaved: boolean
  layers: Layer[]
  onWaypointClick?: (waypointId: string) => void
}

export function DeckGLGoogleOverlay({
  map,
  interleaved,
  layers,
  onWaypointClick,
}: DeckGLGoogleOverlayProps) {
  const overlayRef = useRef<GoogleMapsOverlay | null>(null)

  useEffect(() => {
    if (!map) return
    const overlay = new GoogleMapsOverlay({
      interleaved,
      layers: [],
    })
    overlay.setMap(map)
    overlayRef.current = overlay
    return () => {
      overlay.setMap(null)
      overlay.finalize()
      overlayRef.current = null
    }
  }, [map, interleaved])

  useEffect(() => {
    overlayRef.current?.setProps({
      layers,
      onClick: (info) => {
        if (info.layer?.id !== 'waypoints') return false
        const obj = info.object as { id?: string } | undefined
        if (obj && typeof obj.id === 'string') {
          onWaypointClick?.(obj.id)
        }
        return false
      },
    })
  }, [layers, onWaypointClick])

  return null
}
