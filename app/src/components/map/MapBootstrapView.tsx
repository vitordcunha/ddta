import { useEffect, useRef } from "react"
import { useMap } from "react-leaflet"
import type { MapBootstrapFocus } from "@/hooks/useMapBootstrapFocus"

type Props = {
  focus: MapBootstrapFocus | null
}

/**
 * Aplica centro/zoom quando chegam dados de IP ou GPS (MapContainer so usa props iniciais).
 */
export function MapBootstrapView({ focus }: Props) {
  const map = useMap()
  const lastKey = useRef<string | null>(null)

  useEffect(() => {
    if (!focus) return
    const key = `${focus.center[0].toFixed(5)},${focus.center[1].toFixed(5)},${focus.zoom}`
    if (lastKey.current === key) return
    lastKey.current = key
    map.setView(focus.center, focus.zoom, { animate: false })
  }, [focus, map])

  return null
}
