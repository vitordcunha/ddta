import type { ComponentPropsWithoutRef } from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export function Switch({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "inline-flex h-11 w-[3.75rem] shrink-0 cursor-pointer items-center rounded-full border border-white/15 bg-neutral-700 transition-colors",
        "data-[state=checked]:border-primary-500/35 data-[state=checked]:bg-primary-600",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950",
        "disabled:cursor-not-allowed disabled:opacity-45",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block size-9 rounded-full bg-white shadow transition-transform will-change-transform",
          "translate-x-0.5 data-[state=checked]:translate-x-[1.375rem]",
        )}
      />
    </SwitchPrimitive.Root>
  );
}
