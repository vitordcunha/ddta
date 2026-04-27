import * as Popover from "@radix-ui/react-popover";
import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { FlightPlannerRouteControls } from "@/features/flight-planner/components/FlightPlannerRouteControls";
import { FlightPlannerRoutePositionControls } from "@/features/flight-planner/components/FlightPlannerRoutePositionControls";
import { useFlightPlannerMapHotkeys } from "@/features/flight-planner/hooks/useFlightPlannerMapHotkeys";
import { useFlightStore } from "@/features/flight-planner/stores/useFlightStore";
import { closeDraftToPolygon } from "@/features/flight-planner/utils/polygonDraft";
import { discardLocalFlightPlanSession } from "@/features/flight-planner/utils/flightPlanDraftStorage";
import type { DeviceTier } from "@/features/map-engine/utils/detectDeviceTier";
import type { PlanRailProps } from "./types";
import { LeftRailIconPopoverTrigger } from "./LeftRailIconPopoverTrigger";
import { LeftRailPopoverContent } from "./LeftRailPopoverContent";
import { MapLayersPopover } from "./MapLayersPopover";
import { MapLeftRailMapNavBlock } from "./MapLeftRailMapNavBlock";
import { PlanMissionContextGroup } from "./PlanMissionContextGroup";
import { SidebarModeToggle } from "./SidebarModeToggle";

export type PlanMapRailProps = PlanRailProps & {
  deviceTier: DeviceTier;
};

export function PlanMapRail({
  projectId,
  overlay,
  setOverlay,
  openWeatherApiKey,
  radarStatus,
  radarMessage,
  deviceTier,
}: PlanMapRailProps) {
  const [routeSettingsOpen, setRouteSettingsOpen] = useState(false);
  const [poiMenuOpen, setPoiMenuOpen] = useState(false);

  useFlightPlannerMapHotkeys();

  const mode = useFlightStore((s) => s.plannerInteractionMode);
  const setMode = useFlightStore((s) => s.setPlannerInteractionMode);
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
      {/* ── Ferramentas principais ── */}
      <div className="flex shrink-0 flex-col pt-5 gap-1 overflow-visible">
        <SidebarModeToggle
          deviceTier={deviceTier}
          mode={mode}
          onModeChange={setMode}
        />
        <MapLayersPopover
          deviceTier={deviceTier}
          overlay={overlay}
          setOverlay={setOverlay}
          openWeatherApiKey={openWeatherApiKey}
          radarStatus={radarStatus}
          radarMessage={radarMessage}
        />
      </div>

      {/* ── Contexto de desenho (aparece ao desenhar) ── */}
      <div className="mt-1 min-h-0 overflow-y-auto overscroll-contain">
        <div className="flex flex-col gap-1">
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

      {/* ── Ajustes da rota + Navegação ── */}
      <div className="mt-auto flex shrink-0 flex-col gap-1 pt-1">
        <Popover.Root
          open={routeSettingsOpen}
          onOpenChange={setRouteSettingsOpen}
          modal
        >
          <LeftRailIconPopoverTrigger
            deviceTier={deviceTier}
            open={routeSettingsOpen}
            title="Ajustes da rota: inicio, auto-rotacao, grade e sobreposicoes"
            aria-label="Abrir ajustes da rota"
            icon={SlidersHorizontal}
          />
          <LeftRailPopoverContent deviceTier={deviceTier} maxHeight="32rem">
            <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              Ajustes da rota
            </p>
            <FlightPlannerRoutePositionControls />
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
