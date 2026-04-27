import * as Popover from "@radix-ui/react-popover";
import type { LucideIcon } from "lucide-react";
import type { DeviceTier } from "@/features/map-engine/utils/detectDeviceTier";
import { SidebarButton } from "./SidebarButton";
import { SidebarGroup } from "./SidebarGroup";

type LeftRailIconPopoverTriggerProps = {
  deviceTier: DeviceTier;
  open: boolean;
  title: string;
  "aria-label": string;
  icon: LucideIcon;
};

export function LeftRailIconPopoverTrigger({
  deviceTier,
  open,
  title,
  "aria-label": ariaLabel,
  icon,
}: LeftRailIconPopoverTriggerProps) {
  return (
    <SidebarGroup deviceTier={deviceTier}>
      <Popover.Trigger asChild>
        <SidebarButton icon={icon} label={ariaLabel} open={open} title={title} />
      </Popover.Trigger>
    </SidebarGroup>
  );
}
