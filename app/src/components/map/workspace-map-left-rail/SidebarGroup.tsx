import { maybeBackdropBlur } from "@/lib/deviceUtils";
import { cn } from "@/lib/utils";
import type { DeviceTier } from "@/features/map-engine/utils/detectDeviceTier";

type SidebarGroupProps = {
  children: React.ReactNode;
  deviceTier: DeviceTier;
  "aria-label"?: string;
};

export function SidebarGroup({
  children,
  deviceTier,
  "aria-label": ariaLabel,
}: SidebarGroupProps) {
  return (
    <div
      role={ariaLabel ? "group" : undefined}
      aria-label={ariaLabel}
      className={cn(
        "flex flex-col rounded-xl border border-white/[0.09] bg-[rgba(26,26,26,0.97)] shadow-lg [&>*:first-child]:rounded-t-xl [&>*:last-child]:rounded-b-xl",
        maybeBackdropBlur(deviceTier, "md"),
      )}
    >
      {children}
    </div>
  );
}
