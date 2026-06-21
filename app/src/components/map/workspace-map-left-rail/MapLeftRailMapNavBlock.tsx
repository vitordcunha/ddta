import { Crosshair, Minus, Plus } from "lucide-react";
import { useCallback, useMemo, useRef } from "react";
import { computeFlightPlanMapBounds } from "@/features/flight-planner/utils/computeFlightPlanMapBounds";
import { useFlightStore } from "@/features/flight-planner/stores/useFlightStore";
import { useGeolocationContext } from "@/hooks/GeolocationContext";
import { useMapEngine } from "@/features/map-engine/useMapEngine";
import { useResultsViewStore } from "@/features/results/stores/useResultsViewStore";
import type { DeviceTier } from "@/features/map-engine/utils/detectDeviceTier";
import {
  LOCATE_USER_SECOND_CLICK_WITHIN_MS,
  LOCATE_ZOOM,
  ZOOM_MAX,
  ZOOM_MIN,
} from "./constants";
import { SidebarButton } from "./SidebarButton";
import { SidebarDivider } from "./SidebarDivider";
import { SidebarGroup } from "./SidebarGroup";

type MapLeftRailMapNavBlockProps = {
  deviceTier: DeviceTier;
};

export function MapLeftRailMapNavBlock({
  deviceTier,
}: MapLeftRailMapNavBlockProps) {
  const {
    getMapCenter,
    setCenterZoom,
    zoom,
    fitMapBounds,
    changeZoom,
    provider,
  } = useMapEngine();
  const { error, phase, locate } = useGeolocationContext();
  const autoFitBounds = useResultsViewStore((s) => s.autoFitBounds);
  const polygon = useFlightStore((s) => s.polygon);
  const draftPoints = useFlightStore((s) => s.draftPoints);
  const waypoints = useFlightStore((s) => s.waypoints);
  const poi = useFlightStore((s) => s.poi);

  const planBounds = useMemo(
    () =>
      computeFlightPlanMapBounds({
        polygon,
        draftPoints,
        waypoints,
        poi,
      }),
    [polygon, draftPoints, waypoints, poi],
  );

  const primaryFitBounds = autoFitBounds ?? planBounds;

  /** Timestamp do ultimo clique que encaixou a area (inicia janela para ir ao GPS). */
  const lastPrimaryFitTapMsRef = useRef(0);

  const onZoomIn = useCallback(() => {
    if (zoom >= ZOOM_MAX) return;
    if (provider === "google") {
      setCenterZoom(getMapCenter(), Math.min(ZOOM_MAX, zoom + 1));
      return;
    }
    changeZoom(1);
  }, [getMapCenter, setCenterZoom, changeZoom, provider, zoom]);

  const onZoomOut = useCallback(() => {
    if (zoom <= ZOOM_MIN) return;
    if (provider === "google") {
      setCenterZoom(getMapCenter(), Math.max(ZOOM_MIN, zoom - 1));
      return;
    }
    changeZoom(-1);
  }, [getMapCenter, setCenterZoom, changeZoom, provider, zoom]);

  const flyToUser = useCallback(() => {
    void locate().then((coords) => {
      setCenterZoom([coords.lat, coords.lng], Math.max(zoom, LOCATE_ZOOM));
    });
  }, [locate, setCenterZoom, zoom]);

  const flyToPrimary = useCallback(() => {
    if (!primaryFitBounds) return;
    fitMapBounds(primaryFitBounds, 32);
  }, [primaryFitBounds, fitMapBounds]);

  const onLocateTaps = useCallback(() => {
    const now = Date.now();

    if (!primaryFitBounds) {
      lastPrimaryFitTapMsRef.current = 0;
      flyToUser();
      return;
    }

    const anchor = lastPrimaryFitTapMsRef.current;
    if (
      anchor > 0 &&
      now - anchor < LOCATE_USER_SECOND_CLICK_WITHIN_MS
    ) {
      lastPrimaryFitTapMsRef.current = 0;
      flyToUser();
      return;
    }

    lastPrimaryFitTapMsRef.current = now;
    flyToPrimary();
  }, [primaryFitBounds, flyToPrimary, flyToUser]);

  return (
    <div className="flex flex-col gap-1">
      <SidebarGroup
        deviceTier={deviceTier}
        aria-label="Aproximacao e afastamento do mapa"
      >
        <SidebarButton icon={Plus} label="Aproximar" onClick={onZoomIn} />
        <SidebarDivider />
        <SidebarButton icon={Minus} label="Afastar" onClick={onZoomOut} />
      </SidebarGroup>

      <div
        className="flex min-w-0 max-w-full flex-col gap-1.5"
        aria-live="polite"
      >
        {error ? (
          <p
            className="max-w-full rounded-lg border border-red-500/30 bg-[rgba(26,26,26,0.97)] px-2.5 py-1.5 text-[11px] text-red-200"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <SidebarGroup deviceTier={deviceTier} aria-label="Localizacao e area">
          <SidebarButton
            icon={Crosshair}
            label={
              primaryFitBounds
                ? "Primeiro toque encaixa a area do voo; segundo toque em ate 3 segundos vai para a minha localizacao"
                : "Centralizar o mapa na minha localizacao"
            }
            title={
              primaryFitBounds
                ? "Area do voo: 1 clique. Minha posicao: outro clique em ate 3 s apos o primeiro."
                : "Minha localizacao"
            }
            loading={phase === "loading"}
            onClick={onLocateTaps}
          />
        </SidebarGroup>
      </div>
    </div>
  );
}
