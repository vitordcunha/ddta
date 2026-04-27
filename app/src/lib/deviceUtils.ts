import { useContext } from "react";
import { MapEngineContext } from "@/features/map-engine/MapEngineContext";
import { cn } from "@/lib/utils";
import type { DeviceTier } from "@/features/map-engine/utils/detectDeviceTier";

export type BackdropBlurSize = "sm" | "md" | "lg" | "xl" | "2xl";

const BLUR_CLASS: Record<BackdropBlurSize, string> = {
  sm: "backdrop-blur-sm",
  md: "backdrop-blur-md",
  lg: "backdrop-blur-lg",
  xl: "backdrop-blur-xl",
  "2xl": "backdrop-blur-2xl",
};

/**
 * Aplica `backdrop-blur` só em tier `high` (composição cara em WebView mid-range).
 */
export function maybeBackdropBlur(
  tier: DeviceTier,
  size: BackdropBlurSize,
): string {
  return tier === "high" ? BLUR_CLASS[size] : "";
}

/**
 * Retorna as classes de glass morphism condicionadas ao tier do dispositivo.
 * Em dispositivos low/none, omite backdrop-blur-xl (operação pesada em WebViews Android).
 */
export function glassClass(tier: DeviceTier): string {
  if (tier === "high") return "backdrop-blur-xl bg-[rgba(18,18,20,0.55)]";
  return "bg-[rgba(26,26,26,0.97)]";
}

/** `globals.css`: `.glass-surface` + tint por tier (low sem blur precisa fundo opaco). */
export function glassSurfaceClass(tier: DeviceTier): string {
  return cn(
    "glass-surface",
    tier === "high" ? "glass-surface--tint-high glass-surface--blur" : "glass-surface--tint-low",
  );
}

export function glassCardClass(tier: DeviceTier): string {
  return cn("glass-card", tier === "high" && "glass-card--blur");
}

/** Barra sticky inferior do planejador: sombra + borda + blur condicional. */
export function configStickyBarClass(tier: DeviceTier): string {
  return cn(
    "border-t border-white/[0.08] px-4 pb-3 pt-3",
    "supports-[backdrop-filter]:bg-[#171717]/90",
    "bg-[#171717]/[0.96]",
    maybeBackdropBlur(tier, "md"),
  );
}

export function topBarClass(tier: DeviceTier): string {
  if (tier === "high")
    return "border-b border-[#242424] bg-[rgba(23,23,23,0.92)] backdrop-blur-md";
  return "border-b border-[#242424] bg-[rgba(26,26,26,0.97)]";
}

/**
 * Fila de ações móvel (fundo claro) e grelha: blur só em high.
 */
export function layoutMobileHeaderClass(tier: DeviceTier): string {
  return cn(
    "touch-target touch-manipulation pointer-events-auto flex min-h-12 w-full shrink-0 items-center justify-between gap-2 rounded-t-2xl border border-b-0 border-white/10 bg-[rgba(26,26,26,0.97)] px-4 text-left text-sm font-medium text-[#fafafa] shadow-[0_-4px_24px_rgba(0,0,0,0.35)]",
    maybeBackdropBlur(tier, "md"),
  );
}

export function layoutMobileSheetShellClass(tier: DeviceTier): string {
  return cn(
    "panel-animated pointer-events-auto flex max-h-[min(52svh,560px)] min-h-0 w-full flex-col overflow-hidden rounded-t-2xl border border-b-0 border-white/10 bg-[rgba(26,26,26,0.97)] shadow-[0_-4px_32px_rgba(0,0,0,0.45)]",
    maybeBackdropBlur(tier, "sm"),
  );
}

export function layoutPanelFabClass(tier: DeviceTier): string {
  return cn(
    "touch-target touch-manipulation pointer-events-auto fixed right-0 top-1/2 z-[100] flex min-h-14 w-12 shrink-0 -translate-y-1/2 flex-col items-center justify-center gap-0.5 rounded-l-xl border border-r-0 border-white/10 bg-[rgba(26,26,26,0.97)] py-1.5 text-xs font-medium text-[#e8e8e8] shadow-lg",
    maybeBackdropBlur(tier, "md"),
  );
}

export function layoutPanelCollapseClass(tier: DeviceTier): string {
  return cn(
    "touch-target touch-manipulation flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-white/10 bg-[rgba(26,26,26,0.97)] text-[#b4b4b4] shadow-sm",
    maybeBackdropBlur(tier, "sm"),
  );
}

/**
 * Hook para acessar o deviceTier do MapEngineContext sem importar o contexto diretamente.
 * Retorna 'high' como fallback fora do provider.
 */
export function useDeviceTier(): DeviceTier {
  const ctx = useContext(MapEngineContext);
  return ctx?.deviceTier ?? "high";
}
