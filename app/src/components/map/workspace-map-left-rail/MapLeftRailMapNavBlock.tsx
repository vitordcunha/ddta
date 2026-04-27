import { Crosshair, Loader2, Minus, Plus, ScanSearch } from "lucide-react";
import { useCallback } from "react";
import { useGeolocationContext } from "@/hooks/GeolocationContext";
import { useMapEngine } from "@/features/map-engine/useMapEngine";
import { useResultsViewStore } from "@/features/results/stores/useResultsViewStore";
import type { DeviceTier } from "@/features/map-engine/utils/detectDeviceTier";
import { LOCATE_ZOOM, ZOOM_MAX, ZOOM_MIN } from "./constants";
import { SidebarGroup } from "./SidebarGroup";

type MapLeftRailMapNavBlockProps = {
  deviceTier: DeviceTier;
  showFitProject: boolean;
};

export function MapLeftRailMapNavBlock({
  deviceTier,
  showFitProject,
}: MapLeftRailMapNavBlockProps) {
  const { getMapCenter, setCenterZoom, zoom, fitMapBounds } = useMapEngine();
  const { error, phase, locate } = useGeolocationContext();
  const autoFitBounds = useResultsViewStore((s) => s.autoFitBounds);

  const onZoomIn = useCallback(() => {
    setCenterZoom(getMapCenter(), Math.min(ZOOM_MAX, zoom + 1));
  }, [getMapCenter, setCenterZoom, zoom]);

  const onZoomOut = useCallback(() => {
    setCenterZoom(getMapCenter(), Math.max(ZOOM_MIN, zoom - 1));
  }, [getMapCenter, setCenterZoom, zoom]);

  const onLocate = useCallback(() => {
    void locate().then((coords) => {
      setCenterZoom([coords.lat, coords.lng], Math.max(zoom, LOCATE_ZOOM));
    });
  }, [locate, setCenterZoom, zoom]);

  const onFitProject = useCallback(() => {
    if (!autoFitBounds) return;
    fitMapBounds(autoFitBounds, 32);
  }, [autoFitBounds, fitMapBounds]);

  return (
    <div className="flex flex-col gap-1.5">
      <SidebarGroup
        deviceTier={deviceTier}
        aria-label="Aproximacao e afastamento do mapa"
      >
        <button
          type="button"
          onClick={onZoomIn}
          className="touch-manipulation flex h-12 w-12 items-center justify-center border-b border-white/10 text-neutral-300 transition hover:bg-white/10 active:bg-white/15 md:max-lg:h-10 md:max-lg:w-10"
          title="Aproximar"
          aria-label="Aproximar"
        >
          <Plus className="size-5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onZoomOut}
          className="touch-manipulation flex h-12 w-12 items-center justify-center text-neutral-300 transition hover:bg-white/10 active:bg-white/15 md:max-lg:h-10 md:max-lg:w-10"
          title="Afastar"
          aria-label="Afastar"
        >
          <Minus className="size-5" aria-hidden />
        </button>
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
          {showFitProject && autoFitBounds ? (
            <>
              <button
                type="button"
                onClick={onFitProject}
                className="touch-manipulation flex h-12 w-12 items-center justify-center text-neutral-300 transition hover:bg-white/10 active:bg-white/15 md:max-lg:h-10 md:max-lg:w-10"
                title="Ir para area do projeto"
                aria-label="Centralizar o mapa na area do projeto"
              >
                <ScanSearch className="size-5" aria-hidden />
              </button>
              <div className="mx-2 h-px bg-white/[0.09] md:max-lg:mx-1.5" />
            </>
          ) : null}
          <button
            type="button"
            onClick={onLocate}
            disabled={phase === "loading"}
            className="touch-manipulation flex h-12 w-12 items-center justify-center text-neutral-300 transition hover:bg-white/10 active:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50 md:max-lg:h-10 md:max-lg:w-10"
            title="Minha localizacao"
            aria-label="Centralizar o mapa na minha localizacao"
          >
            {phase === "loading" ? (
              <Loader2
                className="size-5 animate-spin text-primary-300"
                aria-hidden
              />
            ) : (
              <Crosshair className="size-5" aria-hidden />
            )}
          </button>
        </SidebarGroup>
      </div>
    </div>
  );
}
