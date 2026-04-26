import { Battery, Camera, Clock, Focus, Maximize2, Ruler } from "lucide-react";
import { motion } from "framer-motion";
import type { FlightStats } from "@/features/flight-planner/types";

type MissionSummaryBarProps = {
  stats: FlightStats | null;
  isCalculating: boolean;
};

function SkeletonStat() {
  return (
    <div className="flex flex-col gap-1.5 py-0.5">
      <div className="h-2.5 w-12 animate-pulse rounded bg-white/10" />
      <div className="h-5 w-full max-w-[4.5rem] animate-pulse rounded bg-white/10" />
    </div>
  );
}

const STAT_ITEMS = [
  { key: "area", label: "Área", icon: Maximize2, color: "text-primary-400" },
  { key: "photos", label: "Fotos", icon: Camera, color: "text-amber-400" },
  { key: "time", label: "Tempo", icon: Clock, color: "text-orange-400" },
  { key: "batteries", label: "Bateria", icon: Battery, color: "text-sky-400" },
  { key: "gsd", label: "GSD", icon: Focus, color: "text-violet-400" },
  { key: "distance", label: "Distância", icon: Ruler, color: "text-neutral-400" },
] as const;

function getStatValue(stats: FlightStats, key: typeof STAT_ITEMS[number]["key"]): string {
  switch (key) {
    case "area": return `${stats.areaHa.toFixed(1).replace(".", ",")} ha`;
    case "photos": return String(stats.estimatedPhotos);
    case "time": return `${Math.round(stats.estimatedTimeMin)} min`;
    case "batteries": return `${stats.batteryCount} bat.`;
    case "gsd": return `${stats.gsdCm.toFixed(2).replace(".", ",")} cm/px`;
    case "distance": return `${stats.distanceKm.toFixed(2).replace(".", ",")} km`;
  }
}

export function MissionSummaryBar({ stats, isCalculating }: MissionSummaryBarProps) {
  const loading = isCalculating || !stats;

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2.5">
        {STAT_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.key} className="flex flex-col gap-0.5">
              <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-neutral-500">
                <Icon className={`size-3 ${item.color}`} aria-hidden />
                {item.label}
              </p>
              <SkeletonStat />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2.5">
      {STAT_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.key} className="flex flex-col gap-0.5">
            <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-neutral-500">
              <Icon className={`size-3 ${item.color}`} aria-hidden />
              {item.label}
            </p>
            <motion.p
              key={`${item.key}-${stats ? getStatValue(stats, item.key) : ""}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm font-semibold tabular-nums text-neutral-100"
            >
              {stats ? getStatValue(stats, item.key) : "—"}
            </motion.p>
          </div>
        );
      })}
    </div>
  );
}
