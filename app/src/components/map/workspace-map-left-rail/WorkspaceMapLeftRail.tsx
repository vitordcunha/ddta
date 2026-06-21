import { useMapEngine } from "@/features/map-engine/useMapEngine";
import { MapLayersPopover } from "./MapLayersPopover";
import { PlanMapRail } from "./PlanMapRail";
import { ResultsMapRailContent } from "./ResultsMapRailContent";
import type { PlanRailProps, WorkspaceMapLeftRailProps } from "./types";

export type { WorkspaceMapLeftRailProps } from "./types";

export function WorkspaceMapLeftRail(props: WorkspaceMapLeftRailProps) {
  const { deviceTier } = useMapEngine();

  if (props.variant === "plan") {
    return (
      <div className="pointer-events-auto flex h-full min-h-0 w-min min-w-0 flex-1 flex-col items-stretch">
        <PlanMapRail {...props} deviceTier={deviceTier} />
      </div>
    );
  }

  return (
    <div className="pointer-events-auto flex h-full min-h-0 w-min min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-col gap-1 overflow-visible pt-5">
        <MapLayersPopover
          deviceTier={deviceTier}
          overlay={props.overlay}
          setOverlay={props.setOverlay}
          openWeatherApiKey={props.openWeatherApiKey}
          radarStatus={props.radarStatus}
          radarMessage={props.radarMessage}
        />
      </div>
      <div className="min-h-0 flex-1" aria-hidden />
      <ResultsMapRailContent
        deviceTier={deviceTier}
        isAwaitingBoundary={props.isAwaitingBoundary}
      />
    </div>
  );
}

/**
 * @deprecated Use WorkspaceMapLeftRail with variant=plan. Mantido para imports existentes.
 */
export function PlannerIconSidebar(props: Omit<PlanRailProps, "variant">) {
  return <WorkspaceMapLeftRail variant="plan" {...props} />;
}
