import { Crosshair, Loader2 } from "lucide-react"
import { useCallback, useMemo, useRef } from "react"
import { Circle, CircleMarker, useMap } from "react-leaflet"
import type {
  GeolocationCoords,
  GeolocationHookState,
} from "@/hooks/useGeolocation"
import { computeFlightPlanMapBounds } from "@/features/flight-planner/utils/computeFlightPlanMapBounds"
import { useFlightStore } from "@/features/flight-planner/stores/useFlightStore"
import { useResultsViewStore } from "@/features/results/stores/useResultsViewStore"
import { cn } from "@/lib/utils"

const LOCATE_ZOOM = 16
const LOCATE_USER_SECOND_CLICK_WITHIN_MS = 3000
/** Evita circulos enormes no mapa quando a precisao vem inflada */
const MAX_ACCURACY_RADIUS_M = 2000

const BTN =
  "touch-target flex h-12 w-12 items-center justify-center text-[#e8e8e8] transition hover:bg-white/10 active:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"

export type MapUserLocationProps = {
  position: GeolocationCoords | null
  error: string | null
  phase: GeolocationHookState["phase"]
  locate: () => Promise<GeolocationCoords>
}

/** Marcador e circulo de precisao no mapa (sem UI flutuante). */
export function MapUserLocationLayers({
  position,
}: Pick<MapUserLocationProps, "position">) {
  if (!position) return null
  return (
    <>
      {position.accuracy > 0 ? (
        <Circle
          center={[position.lat, position.lng]}
          radius={Math.min(position.accuracy, MAX_ACCURACY_RADIUS_M)}
          pathOptions={{
            color: "#3b82f6",
            fillColor: "#3b82f6",
            fillOpacity: 0.12,
            weight: 1,
          }}
        />
      ) : null}
      <CircleMarker
        center={[position.lat, position.lng]}
        radius={7}
        pathOptions={{
          color: "#ffffff",
          fillColor: "#2563eb",
          fillOpacity: 1,
          weight: 2,
        }}
      />
    </>
  )
}

/**
 * Botao de localizacao (e mensagem de erro). Encaixar dentro do stack inferior esquerdo.
 * 1 toque: area do projeto ou da missao (se houver); 2 toque em ate 3 s: minha posicao.
 */
export function MapUserLocationToolbar({
  error,
  phase,
  locate,
}: Omit<MapUserLocationProps, "position">) {
  const map = useMap()
  const autoFitBounds = useResultsViewStore((s) => s.autoFitBounds)
  const polygon = useFlightStore((s) => s.polygon)
  const draftPoints = useFlightStore((s) => s.draftPoints)
  const waypoints = useFlightStore((s) => s.waypoints)
  const poi = useFlightStore((s) => s.poi)

  const planBounds = useMemo(
    () =>
      computeFlightPlanMapBounds({
        polygon,
        draftPoints,
        waypoints,
        poi,
      }),
    [polygon, draftPoints, waypoints, poi],
  )

  const primaryFitBounds = autoFitBounds ?? planBounds

  const lastPrimaryFitTapMsRef = useRef(0)

  const flyToUser = useCallback(() => {
    void locate().then((coords) => {
      map.flyTo([coords.lat, coords.lng], Math.max(map.getZoom(), LOCATE_ZOOM), {
        duration: 0.75,
      })
    })
  }, [locate, map])

  const flyToPrimary = useCallback(() => {
    if (!primaryFitBounds) return
    map.flyToBounds(primaryFitBounds, { padding: [32, 32], maxZoom: 20, duration: 0.75 })
  }, [primaryFitBounds, map])

  const onLocateButtonClick = useCallback(() => {
    const now = Date.now()

    if (!primaryFitBounds) {
      lastPrimaryFitTapMsRef.current = 0
      flyToUser()
      return
    }

    const anchor = lastPrimaryFitTapMsRef.current
    if (anchor > 0 && now - anchor < LOCATE_USER_SECOND_CLICK_WITHIN_MS) {
      lastPrimaryFitTapMsRef.current = 0
      flyToUser()
      return
    }

    lastPrimaryFitTapMsRef.current = now
    flyToPrimary()
  }, [primaryFitBounds, flyToPrimary, flyToUser])

  return (
    <div className="pointer-events-auto flex flex-col items-stretch gap-2">
      {error ? (
        <p
          className="max-w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-red-500/30 bg-[#121212]/95 px-3 py-2 text-xs text-red-200 shadow-lg backdrop-blur-md"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <div
        className="flex flex-col overflow-hidden rounded-xl border border-white/15 bg-[#121212]/90 shadow-lg backdrop-blur-md"
        aria-live="polite"
      >
        <button
          type="button"
          className={cn(BTN)}
          onClick={onLocateButtonClick}
          disabled={phase === "loading"}
          title={
            primaryFitBounds
              ? "Area do voo: 1 clique. Minha posicao: outro clique em ate 3 s apos o primeiro."
              : "Minha localizacao"
          }
          aria-label={
            primaryFitBounds
              ? "Primeiro toque encaixa a area do voo; segundo toque em ate 3 segundos vai para a minha localizacao"
              : "Centralizar o mapa na minha localizacao"
          }
        >
          {phase === "loading" ? (
            <Loader2 className="size-5 animate-spin" aria-hidden />
          ) : (
            <Crosshair className="size-5" aria-hidden />
          )}
        </button>
      </div>
    </div>
  )
}
