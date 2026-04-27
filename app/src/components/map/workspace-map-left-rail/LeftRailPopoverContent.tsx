import * as Popover from "@radix-ui/react-popover";
import { maybeBackdropBlur } from "@/lib/deviceUtils";
import { cn } from "@/lib/utils";
import type { DeviceTier } from "@/features/map-engine/utils/detectDeviceTier";

type MaxHeightPreset = "22rem" | "28rem" | "32rem";

type LeftRailPopoverContentProps = {
  deviceTier: DeviceTier;
  children: React.ReactNode;
  maxHeight?: MaxHeightPreset;
  className?: string;
};

export function LeftRailPopoverContent({
  deviceTier,
  children,
  maxHeight = "32rem",
  className,
}: LeftRailPopoverContentProps) {
  return (
    <Popover.Portal>
      <Popover.Content
        side="right"
        align="start"
        sideOffset={10}
        collisionPadding={16}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className={cn(
          "z-[100] w-[min(calc(100vw-1.5rem),18.5rem)] overflow-y-auto overscroll-contain rounded-xl border border-white/10 p-3 shadow-2xl outline-none",
          `max-h-[min(75dvh,${maxHeight})]`,
          maybeBackdropBlur(deviceTier, "lg"),
          "bg-[rgba(22,22,22,0.98)]",
          className,
        )}
      >
        {children}
      </Popover.Content>
    </Popover.Portal>
  );
}
