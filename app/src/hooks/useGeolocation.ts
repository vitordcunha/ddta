import { Capacitor } from "@capacitor/core"
import {
  Geolocation,
  type PermissionStatus,
} from "@capacitor/geolocation"
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
      return "Permissao de localizacao negada. No navegador: liberar o site. No app Android: Ajustes > Apps > este app > Permissoes > Localizacao."
    case err.POSITION_UNAVAILABLE:
      return "Nao foi possivel obter a posicao. Tente em outro lugar ou mais tarde."
    case err.TIMEOUT:
      return "Tempo esgotado ao obter a localizacao. Tente novamente."
    default:
      return "Erro ao obter a localizacao."
  }
}

function hasNativeLocationAccess(perm: PermissionStatus): boolean {
  return perm.location === "granted" || perm.coarseLocation === "granted"
}

function coordsFromCapacitor(pos: {
  coords: { latitude: number; longitude: number; accuracy: number }
}): GeolocationCoords {
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
  }
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationHookState>({
    position: null,
    error: null,
    phase: "idle",
  })

  const locate = useCallback((): Promise<GeolocationCoords> => {
    setState((s) => ({
      ...s,
      phase: "loading",
      error: null,
    }))

    if (Capacitor.isNativePlatform()) {
      return (async () => {
        try {
          let perm = await Geolocation.checkPermissions()
          if (!hasNativeLocationAccess(perm)) {
            perm = await Geolocation.requestPermissions()
          }
          if (!hasNativeLocationAccess(perm)) {
            const message =
              "Permissao de localizacao negada. No navegador: liberar o site. No app Android: Ajustes > Apps > este app > Permissoes > Localizacao."
            setState({
              position: null,
              error: message,
              phase: "error",
            })
            throw new Error(message)
          }
          const pos = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 15_000,
            maximumAge: 60_000,
          })
          const coords = coordsFromCapacitor(pos)
          setState({
            position: coords,
            error: null,
            phase: "ready",
          })
          return coords
        } catch (e: unknown) {
          const message =
            e instanceof Error && e.message
              ? e.message
              : "Erro ao obter a localizacao."
          setState({
            position: null,
            error: message,
            phase: "error",
          })
          throw e
        }
      })()
    }

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
