import { AnimatePresence, motion } from "framer-motion";
import { Lock } from "lucide-react";
import { maybeBackdropBlur } from "@/lib/deviceUtils";
import { cn } from "@/lib/utils";
import {
  PLANNER_BASE_LAYER_IDS,
  getPlannerBaseLayerConfig,
  type PlannerBaseLayerId,
} from "@/features/flight-planner/constants/mapBaseLayers";
import { useMapEngine } from "@/features/map-engine/useMapEngine";
import type { MapProvider } from "@/features/map-engine/types";
import type { DeviceTier } from "@/features/map-engine/utils/detectDeviceTier";

type PlanMapStylePanelProps = {
  open: boolean;
  deviceTier: DeviceTier;
  baseLayer: PlannerBaseLayerId;
  setBaseLayer: (id: PlannerBaseLayerId) => void;
  onAfterLayerOrProviderChange: () => void;
};

const MAP_PROVIDERS = [
  { id: "leaflet" as const, label: "Leaflet" },
  { id: "mapbox" as const, label: "Mapbox" },
  { id: "google" as const, label: "Google Maps" },
] satisfies { id: MapProvider; label: string }[];

export function PlanMapStylePanel({
  open,
  deviceTier,
  baseLayer,
  setBaseLayer,
  onAfterLayerOrProviderChange,
}: PlanMapStylePanelProps) {
  const {
    provider: mapProvider,
    mode: mapViewMode,
    setProvider,
    setMode: setMapViewMode,
  } = useMapEngine();

  const map3dHint =
    deviceTier === "low" || deviceTier === "none"
      ? "Seu dispositivo pode nao suportar visualizacao 3D com performance adequada."
      : undefined;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="planner-map-style"
          initial={{ opacity: 0, x: -6, scale: 0.97 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -6, scale: 0.97 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className={cn(
            "absolute left-full top-0 z-[60] ml-2 w-52 rounded-2xl border border-white/10 bg-[rgba(26,26,26,0.97)] p-3 shadow-2xl",
            maybeBackdropBlur(deviceTier, "xl"),
          )}
        >
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            Estilo do mapa
          </p>
          <div className="flex flex-col gap-1">
            {PLANNER_BASE_LAYER_IDS.map((id) => {
              const sel = baseLayer === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setBaseLayer(id);
                    onAfterLayerOrProviderChange();
                  }}
                  className={cn(
                    "w-full touch-manipulation rounded-lg border px-3 py-2.5 text-left text-xs font-medium transition",
                    sel
                      ? "border-primary-500/40 bg-primary-500/12 text-white"
                      : "border-white/10 bg-white/[0.04] text-neutral-300 hover:bg-white/[0.08] hover:text-white",
                  )}
                >
                  {getPlannerBaseLayerConfig(id).label}
                </button>
              );
            })}
          </div>
          <p className="mb-2 mt-3 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            Provedor
          </p>
          <div className="flex flex-col gap-1">
            {MAP_PROVIDERS.map(({ id, label }) => {
              const sel = mapProvider === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setProvider(id);
                    onAfterLayerOrProviderChange();
                  }}
                  className={cn(
                    "w-full touch-manipulation rounded-lg border px-3 py-2.5 text-left text-xs font-medium transition",
                    sel
                      ? "border-primary-500/40 bg-primary-500/12 text-white"
                      : "border-white/10 bg-white/[0.04] text-neutral-300 hover:bg-white/[0.08] hover:text-white",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              2D / 3D
            </p>
            {mapProvider === "leaflet" ? (
              <Lock
                className="size-3.5 shrink-0 text-neutral-500"
                aria-hidden
              />
            ) : null}
          </div>
          <div className="mt-1.5 flex gap-1">
            <button
              type="button"
              disabled={mapProvider === "leaflet"}
              onClick={() => setMapViewMode("2d")}
              className={cn(
                "touch-manipulation flex-1 rounded-lg border px-2 py-2 text-[11px] font-medium transition",
                mapViewMode === "2d"
                  ? "border-primary-500/40 bg-primary-500/12 text-white"
                  : "border-white/10 bg-white/[0.04] text-neutral-300 hover:bg-white/[0.08]",
                mapProvider === "leaflet" &&
                  "cursor-not-allowed opacity-40 hover:bg-white/[0.04]",
              )}
            >
              2D
            </button>
            <button
              type="button"
              disabled={mapProvider === "leaflet" || deviceTier === "none"}
              onClick={() => setMapViewMode("3d")}
              title={map3dHint}
              className={cn(
                "touch-manipulation flex-1 rounded-lg border px-2 py-2 text-[11px] font-medium transition",
                mapViewMode === "3d"
                  ? "border-primary-500/40 bg-primary-500/12 text-white"
                  : "border-white/10 bg-white/[0.04] text-neutral-300 hover:bg-white/[0.08]",
                (mapProvider === "leaflet" || deviceTier === "none") &&
                  "cursor-not-allowed opacity-40 hover:bg-white/[0.04]",
              )}
            >
              3D
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
