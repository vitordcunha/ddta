import { useRef, useState } from "react";
import { useMapEngine } from "@/features/map-engine/useMapEngine";
import { PlanMapRail } from "./PlanMapRail";
import { ResultsMapRailContent } from "./ResultsMapRailContent";
import type { PlanRailProps, WorkspaceMapLeftRailProps } from "./types";
import { useMapStyleOutsideDismiss } from "./useMapStyleOutsideDismiss";

export type { WorkspaceMapLeftRailProps } from "./types";

export function WorkspaceMapLeftRail(props: WorkspaceMapLeftRailProps) {
  const { deviceTier } = useMapEngine();
  const [mapStyleOpen, setMapStyleOpen] = useState(false);
  const mapStyleRef = useRef<HTMLDivElement | null>(null);

  useMapStyleOutsideDismiss(mapStyleRef, setMapStyleOpen);

  if (props.variant === "plan") {
    return (
      <div className="pointer-events-auto flex h-full min-h-0 w-min min-w-0 flex-1 flex-col items-stretch">
        <PlanMapRail
          {...props}
          deviceTier={deviceTier}
          mapStyleOpen={mapStyleOpen}
          setMapStyleOpen={setMapStyleOpen}
          mapStyleRef={mapStyleRef}
        />
      </div>
    );
  }

  return (
    <div className="pointer-events-auto flex h-full min-h-0 w-min min-w-0 flex-1 flex-col">
      <div className="min-h-0 flex-1" aria-hidden />
      <ResultsMapRailContent deviceTier={deviceTier} />
    </div>
  );
}

/**
 * @deprecated Use WorkspaceMapLeftRail with variant=plan. Mantido para imports existentes.
 */
export function PlannerIconSidebar(props: Omit<PlanRailProps, "variant">) {
  return <WorkspaceMapLeftRail variant="plan" {...props} />;
}
