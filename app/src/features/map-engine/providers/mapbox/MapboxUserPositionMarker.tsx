import { Marker } from "react-map-gl/mapbox"
import { useGeolocationContext } from "@/hooks/GeolocationContext"

/**
 * Marcador de posicao do usuario (um unico store de geoloc via GeolocationProvider).
 */
export function MapboxUserPositionMarker() {
  const { position } = useGeolocationContext()
  if (!position) return null
  return (
    <Marker longitude={position.lng} latitude={position.lat} anchor="center">
      <div
        className="size-3.5 rounded-full border-2 border-white bg-[#2563eb] shadow-md"
        aria-hidden
      />
    </Marker>
  )
}
