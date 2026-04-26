import { useEffect, useMemo, useState } from "react"

/** Centro aproximado por IP (cidade / regiao); sem chave de API (geojs.io). */
const GEOJS_GEO_URL = "https://get.geojs.io/v1/ip/geo.json"

export type MapBootstrapFocus = {
  center: [number, number]
  zoom: number
}

type InternalFocus =
  | { phase: "ip"; center: [number, number]; zoom: number }
  | { phase: "gps"; center: [number, number]; zoom: number }

const ZOOM_IP = 12
const ZOOM_GPS = 15

type Options = {
  locate: () => Promise<{ lat: number; lng: number }>
}

/**
 * Orquestra vista inicial: GPS (prioridade) ou, enquanto indisponivel, centro por IP.
 */
export function useMapBootstrapFocus({ locate }: Options): MapBootstrapFocus | null {
  const [internal, setInternal] = useState<InternalFocus | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch(GEOJS_GEO_URL)
      .then((r) => r.json())
      .then((data: { latitude?: string; longitude?: string }) => {
        if (cancelled) return
        const lat = Number(data.latitude)
        const lng = Number(data.longitude)
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
        setInternal((current) =>
          current?.phase === "gps"
            ? current
            : { phase: "ip", center: [lat, lng], zoom: ZOOM_IP },
        )
      })
      .catch(() => {})

    locate()
      .then((coords) => {
        if (cancelled) return
        setInternal({
          phase: "gps",
          center: [coords.lat, coords.lng],
          zoom: ZOOM_GPS,
        })
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [locate])

  return useMemo(() => {
    if (!internal) return null
    return { center: internal.center, zoom: internal.zoom }
  }, [internal])
}
