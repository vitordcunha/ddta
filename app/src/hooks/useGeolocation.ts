import { useCallback, useState } from "react"

export type GeolocationCoords = {
  lat: number
  lng: number
  /** meters */
  accuracy: number
}

export type GeolocationHookState = {
  position: GeolocationCoords | null
  error: string | null
  phase: "idle" | "loading" | "ready" | "error"
}

function messageFromGeolocationError(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return "Permissao de localizacao negada. Ative nas configuracoes do navegador."
    case err.POSITION_UNAVAILABLE:
      return "Nao foi possivel obter a posicao. Tente em outro lugar ou mais tarde."
    case err.TIMEOUT:
      return "Tempo esgotado ao obter a localizacao. Tente novamente."
    default:
      return "Erro ao obter a localizacao."
  }
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationHookState>({
    position: null,
    error: null,
    phase: "idle",
  })

  const locate = useCallback((): Promise<GeolocationCoords> => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      const message =
        "Geolocalizacao nao suportada neste navegador ou ambiente."
      setState({
        position: null,
        error: message,
        phase: "error",
      })
      return Promise.reject(new Error(message))
    }

    setState((s) => ({
      ...s,
      phase: "loading",
      error: null,
    }))

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords: GeolocationCoords = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          }
          setState({
            position: coords,
            error: null,
            phase: "ready",
          })
          resolve(coords)
        },
        (err) => {
          const message = messageFromGeolocationError(err)
          setState({
            position: null,
            error: message,
            phase: "error",
          })
          reject(err)
        },
        {
          enableHighAccuracy: true,
          timeout: 15_000,
          maximumAge: 60_000,
        },
      )
    })
  }, [])

  return { ...state, locate }
}
