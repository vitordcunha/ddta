import { Crosshair, Minus, Plus, ScanSearch } from "lucide-react";
import { useCallback } from "react";
import { useGeolocationContext } from "@/hooks/GeolocationContext";
import { useMapEngine } from "@/features/map-engine/useMapEngine";
import { useResultsViewStore } from "@/features/results/stores/useResultsViewStore";
import type { DeviceTier } from "@/features/map-engine/utils/detectDeviceTier";
import { LOCATE_ZOOM, ZOOM_MAX, ZOOM_MIN } from "./constants";
import { SidebarButton } from "./SidebarButton";
import { SidebarDivider } from "./SidebarDivider";
import { SidebarGroup } from "./SidebarGroup";

type MapLeftRailMapNavBlockProps = {
  deviceTier: DeviceTier;
  showFitProject: boolean;
};

export function MapLeftRailMapNavBlock({
  deviceTier,
  showFitProject,
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
    <div className="flex flex-col gap-1">
      <SidebarGroup deviceTier={deviceTier} aria-label="Aproximacao e afastamento do mapa">
        <SidebarButton icon={Plus} label="Aproximar" onClick={onZoomIn} />
        <SidebarDivider />
        <SidebarButton icon={Minus} label="Afastar" onClick={onZoomOut} />
      </SidebarGroup>

      <div className="flex min-w-0 max-w-full flex-col gap-1.5" aria-live="polite">
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
              <SidebarButton
                icon={ScanSearch}
                label="Centralizar o mapa na area do projeto"
                title="Ir para area do projeto"
                onClick={onFitProject}
              />
              <SidebarDivider />
            </>
          ) : null}
          <SidebarButton
            icon={Crosshair}
            label="Centralizar o mapa na minha localizacao"
            title="Minha localizacao"
            loading={phase === "loading"}
            onClick={onLocate}
          />
        </SidebarGroup>
      </div>
    </div>
  );
}
