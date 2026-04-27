import * as Popover from "@radix-ui/react-popover";
import type { LucideIcon } from "lucide-react";
import { maybeBackdropBlur } from "@/lib/deviceUtils";
import { cn } from "@/lib/utils";
import type { DeviceTier } from "@/features/map-engine/utils/detectDeviceTier";

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
  icon: Icon,
}: LeftRailIconPopoverTriggerProps) {
  return (
    <Popover.Trigger asChild>
      <button
        type="button"
        title={title}
        aria-label={ariaLabel}
        aria-pressed={open}
        className={cn(
          "flex h-12 w-12 min-h-12 min-w-12 items-center justify-center touch-manipulation rounded-xl border border-white/[0.09] bg-[rgba(26,26,26,0.97)] text-neutral-300 transition hover:bg-white/[0.08] active:bg-white/12 md:max-lg:min-h-10 md:max-lg:min-w-10 md:max-lg:h-10 md:max-lg:w-10",
          maybeBackdropBlur(deviceTier, "md"),
          open && "bg-primary-500/15 text-primary-300",
        )}
      >
        <Icon className="size-[18px] md:max-lg:size-4" aria-hidden />
      </button>
    </Popover.Trigger>
  );
}
