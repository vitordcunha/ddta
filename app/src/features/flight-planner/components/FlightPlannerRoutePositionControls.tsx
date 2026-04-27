import { Compass, Loader2, MapPin } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useDroneModelsQuery } from "@/features/flight-planner/hooks/useDroneModelsQuery";
import {
  profileToDroneSpec,
  resolveFlightDroneProfile,
} from "@/features/flight-planner/utils/flightDroneProfile";
import { useFlightStore } from "@/features/flight-planner/stores/useFlightStore";
import {
  calculateFootprint,
  calculateGsd,
  calculateOptimalRotation,
  calculateSpacings,
} from "@/features/flight-planner/utils/waypointCalculator";
import { useGeolocation } from "@/hooks/useGeolocation";

/**
 * Início da rota (GPS) e auto-rotação — usado no popover «Ajustes da rota» da barra lateral.
 */
export function FlightPlannerRoutePositionControls() {
  const polygon = useFlightStore((s) => s.polygon);
  const params = useFlightStore((s) => s.params);
  const setParams = useFlightStore((s) => s.setParams);
  const routeStartRef = useFlightStore((s) => s.routeStartRef);
  const setRouteStartRef = useFlightStore((s) => s.setRouteStartRef);

  const {
    locate,
    position: geoPosition,
    phase: geoPhase,
    error: geoError,
  } = useGeolocation();

  const { data: droneCatalog } = useDroneModelsQuery();
  const resolvedDroneProfile = useMemo(
    () => resolveFlightDroneProfile(params, droneCatalog),
    [params, droneCatalog],
  );

  const onAutoRotation = () => {
    if (!polygon) return;
    const spec = profileToDroneSpec(resolvedDroneProfile);
    const gsdM = calculateGsd(params.altitudeM, spec);
    const footprint = calculateFootprint(gsdM, spec);
    const spacings = calculateSpacings(
      footprint,
      params.forwardOverlap,
      params.sideOverlap,
    );

    const applyWithLocation = (userPos: { lat: number; lng: number }) => {
      setRouteStartRef({ lat: userPos.lat, lng: userPos.lng });
      const optimal = calculateOptimalRotation(
        polygon,
        spacings,
        params.altitudeM,
        userPos,
      );
      setParams({ rotationDeg: optimal });
    };

    if (geoPosition) {
      applyWithLocation(geoPosition);
    } else {
      void locate()
        .then(applyWithLocation)
        .catch(() => {
          const optimal = calculateOptimalRotation(
            polygon,
            spacings,
            params.altitudeM,
          );
          setParams({ rotationDeg: optimal });
        });
    }
  };

  return (
    <div className="space-y-3 border-b border-white/[0.08] pb-3">
      <div>
        <p className="mb-1.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-[#8a8a8a]">
          <MapPin className="size-3" aria-hidden />
          Início da rota
        </p>
        <p className="mb-2 text-[11px] leading-snug text-neutral-500">
          Ordem das faixas e sentido para o primeiro waypoint ficar perto da sua
          posição (GPS).
        </p>
        <div className="flex flex-col gap-1.5">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="touch-manipulation h-11 w-full min-h-11 justify-start gap-2"
            disabled={!polygon || geoPhase === "loading"}
            onClick={() => {
              void locate().then((c) =>
                setRouteStartRef({ lat: c.lat, lng: c.lng }),
              );
            }}
          >
            {geoPhase === "loading" ? (
              <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <MapPin className="size-4 shrink-0" aria-hidden />
            )}
            Usar minha posição
          </Button>
          {routeStartRef ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="touch-manipulation h-9 w-full justify-start text-xs"
              onClick={() => setRouteStartRef(null)}
            >
              Ordem padrão
            </Button>
          ) : null}
        </div>
        {routeStartRef ? (
          <p className="mt-2 text-[11px] text-primary-300/90">
            Otimização ativa: início próximo de{" "}
            {routeStartRef.lat.toFixed(5)}, {routeStartRef.lng.toFixed(5)}.
          </p>
        ) : null}
        {geoError ? (
          <p className="mt-2 text-[11px] text-red-300/95">{geoError}</p>
        ) : null}
        {!polygon ? (
          <p className="mt-2 text-[11px] text-neutral-500">
            Feche a área no mapa para habilitar.
          </p>
        ) : null}
      </div>

      <div>
        <p className="mb-1.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-[#8a8a8a]">
          <Compass className="size-3" aria-hidden />
          Auto-rotação
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="touch-manipulation h-11 w-full min-h-11 justify-start gap-2 text-[11px]"
          disabled={!polygon || geoPhase === "loading"}
          title="Calcula o ângulo ótimo e define o início mais próximo da sua posição"
          onClick={onAutoRotation}
        >
          {geoPhase === "loading" ? (
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
          ) : (
            <Compass className="size-4 shrink-0" aria-hidden />
          )}
          Auto-rotação
        </Button>
        <p
          className={cn(
            "mt-1.5 text-[10px] leading-snug text-neutral-500",
            !polygon && "text-neutral-600",
          )}
        >
          {routeStartRef
            ? "Ângulo + início otimizados quando há GPS."
            : "Ângulo ideal; com GPS, também ajusta o início pela sua posição."}
        </p>
      </div>
    </div>
  );
}
