import { Crosshair, Ruler, Square, Trash2 } from "lucide-react";
import { useResultsViewStore } from "@/features/results/stores/useResultsViewStore";
import type { DeviceTier } from "@/features/map-engine/utils/detectDeviceTier";
import { MapLeftRailMapNavBlock } from "./MapLeftRailMapNavBlock";
import { SidebarButton } from "./SidebarButton";
import { SidebarDivider } from "./SidebarDivider";
import { SidebarGroup } from "./SidebarGroup";

type ResultsMapRailContentProps = {
  deviceTier: DeviceTier;
};

export function ResultsMapRailContent({
  deviceTier,
}: ResultsMapRailContentProps) {
  const activeLayer = useResultsViewStore((s) => s.activeLayer);
  const tool = useResultsViewStore((s) => s.tool);
  const setTool = useResultsViewStore((s) => s.setTool);
  const clearDrawing = useResultsViewStore((s) => s.clearDrawing);
  const canMeasure = activeLayer !== "orthophoto";

  return (
    <div className="mt-auto flex shrink-0 flex-col gap-1 pt-1">
      <SidebarGroup deviceTier={deviceTier} aria-label="Ferramentas de medicao">
        <SidebarButton
          icon={Ruler}
          label="Distancia"
          active={tool === "distance"}
          activeColor="green"
          disabled={!canMeasure}
          onClick={() => setTool("distance")}
        />
        <SidebarDivider />
        <SidebarButton
          icon={Square}
          label="Area"
          active={tool === "area"}
          activeColor="green"
          disabled={!canMeasure}
          onClick={() => setTool("area")}
        />
        <SidebarDivider />
        <SidebarButton
          icon={Crosshair}
          label="Cota"
          active={tool === "elevation"}
          activeColor="green"
          disabled={!canMeasure}
          onClick={() => setTool("elevation")}
        />
        {tool !== "none" ? (
          <>
            <SidebarDivider />
            <SidebarButton
              icon={Trash2}
              label="Limpar medicoes"
              activeColor="red"
              onClick={clearDrawing}
            />
          </>
        ) : null}
      </SidebarGroup>
      <MapLeftRailMapNavBlock deviceTier={deviceTier} showFitProject />
    </div>
  );
}
