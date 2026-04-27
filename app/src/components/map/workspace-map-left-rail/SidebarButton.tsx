import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type SidebarButtonProps = {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  activeColor?: "neutral" | "green" | "red";
};

export function SidebarButton({
  icon: Icon,
  label,
  active,
  onClick,
  disabled,
  activeColor = "neutral",
}: SidebarButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "touch-manipulation flex h-12 w-12 items-center justify-center transition-all duration-150 md:max-lg:h-10 md:max-lg:w-10",
        "disabled:cursor-not-allowed disabled:opacity-25",
        active
          ? activeColor === "green"
            ? "bg-primary-500/20 text-primary-400"
            : activeColor === "red"
              ? "bg-red-500/20 text-red-400"
              : "bg-white/12 text-white"
          : activeColor === "green"
            ? "text-neutral-400 hover:bg-primary-500/10 hover:text-primary-300"
            : activeColor === "red"
              ? "text-neutral-400 hover:bg-red-500/10 hover:text-red-300"
              : "text-neutral-400 hover:bg-white/[0.08] hover:text-white",
      )}
    >
      <Icon className="size-[18px] md:max-lg:size-4" aria-hidden />
    </button>
  );
}
