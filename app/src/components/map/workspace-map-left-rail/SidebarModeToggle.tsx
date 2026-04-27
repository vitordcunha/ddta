import { Hand, Pencil } from "lucide-react";
import type { DeviceTier } from "@/features/map-engine/utils/detectDeviceTier";
import { SidebarButton } from "./SidebarButton";
import { SidebarDivider } from "./SidebarDivider";
import { SidebarGroup } from "./SidebarGroup";

type PlannerMode = "navigate" | "draw";

type SidebarModeToggleProps = {
  deviceTier: DeviceTier;
  mode: PlannerMode;
  onModeChange: (mode: PlannerMode) => void;
};

export function SidebarModeToggle({
  deviceTier,
  mode,
  onModeChange,
}: SidebarModeToggleProps) {
  return (
    <SidebarGroup deviceTier={deviceTier} aria-label="Modo de interacao">
      <SidebarButton
        icon={Hand}
        label="Navegar (N)"
        active={mode === "navigate"}
        onClick={() => onModeChange("navigate")}
      />
      <SidebarDivider />
      <SidebarButton
        icon={Pencil}
        label="Desenhar (D)"
        active={mode === "draw"}
        activeColor="green"
        onClick={() => onModeChange("draw")}
      />
    </SidebarGroup>
  );
}
