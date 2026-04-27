import { Loader2 } from "lucide-react";
import { forwardRef } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type SidebarButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  /** Intermediate state when a popover triggered by this button is open */
  open?: boolean;
  loading?: boolean;
  activeColor?: "neutral" | "green" | "red";
};

export const SidebarButton = forwardRef<HTMLButtonElement, SidebarButtonProps>(
  function SidebarButton(
    {
      icon: Icon,
      label,
      active,
      open,
      loading,
      disabled,
      activeColor = "neutral",
      className,
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type="button"
        title={label}
        aria-label={label}
        aria-pressed={active}
        disabled={disabled || loading}
        className={cn(
          "touch-manipulation flex h-12 w-12 items-center justify-center transition-all duration-150 md:max-lg:h-10 md:max-lg:w-10",
          "disabled:cursor-not-allowed disabled:opacity-25",
          active
            ? activeColor === "green"
              ? "bg-primary-500/20 text-primary-400"
              : activeColor === "red"
                ? "bg-red-500/20 text-red-400"
                : "bg-white/12 text-white"
            : open
              ? activeColor === "green"
                ? "bg-primary-500/15 text-primary-300"
                : activeColor === "red"
                  ? "bg-red-500/15 text-red-300"
                  : "bg-white/[0.08] text-white"
              : activeColor === "green"
                ? "text-neutral-400 hover:bg-primary-500/10 hover:text-primary-300"
                : activeColor === "red"
                  ? "text-neutral-400 hover:bg-red-500/10 hover:text-red-300"
                  : "text-neutral-400 hover:bg-white/[0.08] hover:text-white",
          className,
        )}
        {...rest}
      >
        {loading ? (
          <Loader2
            className="size-[18px] animate-spin text-primary-300 md:max-lg:size-4"
            aria-hidden
          />
        ) : (
          <Icon className="size-[18px] md:max-lg:size-4" aria-hidden />
        )}
      </button>
    );
  },
);
