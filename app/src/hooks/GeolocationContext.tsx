import { createContext, useContext, type ReactNode } from "react"
import { useGeolocation } from "@/hooks/useGeolocation"

export type GeolocationContextValue = ReturnType<typeof useGeolocation>

const GeolocationContext = createContext<GeolocationContextValue | null>(null)

/**
 * Uma unica instancia de geolocalizacao para a barra do mapa, camadas (Leaflet/Mapbox)
 * e ações de "minha posicao" — evita estados desincronizados entre UI e marcadores.
 */
export function GeolocationProvider({ children }: { children: ReactNode }) {
  const value = useGeolocation()
  return (
    <GeolocationContext.Provider value={value}>
      {children}
    </GeolocationContext.Provider>
  )
}

export function useGeolocationContext(): GeolocationContextValue {
  const c = useContext(GeolocationContext)
  if (!c) {
    throw new Error("useGeolocationContext requer GeolocationProvider")
  }
  return c
}
