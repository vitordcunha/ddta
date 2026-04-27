import * as Popover from "@radix-ui/react-popover";
import { Hand, Map as MapIcon, Pencil, SlidersHorizontal } from "lucide-react";
import { useState, type RefObject, type SetStateAction } from "react";
import { WeatherLayerMapControls } from "@/components/map/WeatherLayerMapControls";
import { FlightPlannerRouteControls } from "@/features/flight-planner/components/FlightPlannerRouteControls";
import { useFlightPlannerMapHotkeys } from "@/features/flight-planner/hooks/useFlightPlannerMapHotkeys";
import { useFlightStore } from "@/features/flight-planner/stores/useFlightStore";
import { closeDraftToPolygon } from "@/features/flight-planner/utils/polygonDraft";
import { discardLocalFlightPlanSession } from "@/features/flight-planner/utils/flightPlanDraftStorage";
import type { DeviceTier } from "@/features/map-engine/utils/detectDeviceTier";
import type { PlanRailProps } from "./types";
import { LeftRailIconPopoverTrigger } from "./LeftRailIconPopoverTrigger";
import { LeftRailPopoverContent } from "./LeftRailPopoverContent";
import { MapLeftRailMapNavBlock } from "./MapLeftRailMapNavBlock";
import { PlanMapStylePanel } from "./PlanMapStylePanel";
import { PlanMissionContextGroup } from "./PlanMissionContextGroup";
import { SidebarButton } from "./SidebarButton";
import { SidebarGroup } from "./SidebarGroup";

export type PlanMapRailProps = PlanRailProps & {
  deviceTier: DeviceTier;
  mapStyleOpen: boolean;
  setMapStyleOpen: (value: SetStateAction<boolean>) => void;
  mapStyleRef: RefObject<HTMLDivElement | null>;
};

export function PlanMapRail({
  projectId,
  overlay,
  setOverlay,
  openWeatherApiKey,
  radarStatus,
  radarMessage,
  deviceTier,
  mapStyleOpen,
  setMapStyleOpen,
  mapStyleRef,
}: PlanMapRailProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [poiMenuOpen, setPoiMenuOpen] = useState(false);

  useFlightPlannerMapHotkeys();

  const mode = useFlightStore((s) => s.plannerInteractionMode);
  const setMode = useFlightStore((s) => s.setPlannerInteractionMode);
  const baseLayer = useFlightStore((s) => s.plannerBaseLayer);
  const setPlannerBaseLayer = useFlightStore((s) => s.setPlannerBaseLayer);
  const draftPoints = useFlightStore((s) => s.draftPoints);
  const setDraftPoints = useFlightStore((s) => s.setDraftPoints);
  const popLastDraftPoint = useFlightStore((s) => s.popLastDraftPoint);
  const setPolygon = useFlightStore((s) => s.setPolygon);
  const polygon = useFlightStore((s) => s.polygon);
  const poi = useFlightStore((s) => s.poi);
  const poiPlacementActive = useFlightStore((s) => s.poiPlacementActive);
  const setPoiPlacementActive = useFlightStore((s) => s.setPoiPlacementActive);
  const setPoi = useFlightStore((s) => s.setPoi);

  const hasDraft = draftPoints.length > 0;
  const canClose = draftPoints.length >= 3;
  const hasPolygon = Boolean(polygon);
  const showDrawActions = hasDraft || hasPolygon;

  const onClose = () => {
    if (!canClose) return;
    const closed = closeDraftToPolygon(draftPoints);
    if (!closed) return;
    setPolygon(closed);
    setDraftPoints([]);
  };

  const onClear = () => {
    if (projectId) {
      discardLocalFlightPlanSession(projectId);
    } else {
      setDraftPoints([]);
      setPolygon(null);
    }
  };

  return (
    <>
      <div className="shrink-0 overflow-visible">
        <SidebarGroup deviceTier={deviceTier} aria-label="Ferramentas do mapa">
          <SidebarButton
            icon={Hand}
            label="Navegar (N)"
            active={mode === "navigate"}
            onClick={() => setMode("navigate")}
          />
          <div className="mx-2 h-px bg-white/[0.07] md:max-lg:mx-1.5" />
          <SidebarButton
            icon={Pencil}
            label="Desenhar (D)"
            active={mode === "draw"}
            activeColor="green"
            onClick={() => setMode("draw")}
          />
          <div className="mx-2 h-px bg-white/[0.07] md:max-lg:mx-1.5" />

          <div ref={mapStyleRef} className="relative z-[60]">
            <SidebarButton
              icon={MapIcon}
              label="Estilo do mapa"
              active={mapStyleOpen}
              onClick={() => setMapStyleOpen((o) => !o)}
            />
            <PlanMapStylePanel
              open={mapStyleOpen}
              deviceTier={deviceTier}
              baseLayer={baseLayer}
              setBaseLayer={setPlannerBaseLayer}
              onAfterLayerOrProviderChange={() => setMapStyleOpen(false)}
            />
          </div>
          <WeatherLayerMapControls
            placement="sidebar"
            overlay={overlay}
            setOverlay={setOverlay}
            openWeatherApiKey={openWeatherApiKey}
            radarStatus={radarStatus}
            radarMessage={radarMessage}
          />
        </SidebarGroup>
      </div>

      <div className="mt-1.5 min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="flex flex-col gap-1.5">
          <PlanMissionContextGroup
            show={showDrawActions}
            deviceTier={deviceTier}
            hasPolygon={hasPolygon}
            hasDraft={hasDraft}
            canClose={canClose}
            poiMenuOpen={poiMenuOpen}
            setPoiMenuOpen={setPoiMenuOpen}
            poiPlacementActive={poiPlacementActive}
            setPoiPlacementActive={setPoiPlacementActive}
            poi={poi}
            setPoi={setPoi}
            onClose={onClose}
            onClear={onClear}
            popLastDraftPoint={popLastDraftPoint}
          />
        </div>
      </div>

      <div className="mt-auto flex shrink-0 flex-col gap-1.5 pt-1.5">
        <Popover.Root open={moreOpen} onOpenChange={setMoreOpen} modal>
          <LeftRailIconPopoverTrigger
            deviceTier={deviceTier}
            open={moreOpen}
            title="Ajustes da rota: rotacao, sobreposicoes"
            aria-label="Abrir ajustes da rota: rotacao da grade, sobreposicoes"
            icon={SlidersHorizontal}
          />
          <LeftRailPopoverContent deviceTier={deviceTier} maxHeight="32rem">
            <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              Ajustes da rota
            </p>
            <FlightPlannerRouteControls />
          </LeftRailPopoverContent>
        </Popover.Root>
        <MapLeftRailMapNavBlock
          deviceTier={deviceTier}
          showFitProject={false}
        />
      </div>
    </>
  );
}
