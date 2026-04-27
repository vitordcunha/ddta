import * as Popover from "@radix-ui/react-popover";
import {
  CloudSun,
  Droplets,
  Layers,
  Lock,
  Loader2,
  Thermometer,
  Wind,
} from "lucide-react";
import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { toWorkspace } from "@/constants/routes";
import {
  PLANNER_BASE_LAYER_IDS,
  getPlannerBaseLayerConfig,
} from "@/features/flight-planner/constants/mapBaseLayers";
import { useFlightStore } from "@/features/flight-planner/stores/useFlightStore";
import { useMapEngine } from "@/features/map-engine/useMapEngine";
import type { DeviceTier } from "@/features/map-engine/utils/detectDeviceTier";
import type { MapProvider } from "@/features/map-engine/types";
import type { RadarOverlayStatus } from "@/components/map/PlannerWeatherMapLayers";
import {
  DEFAULT_WEATHER_MAP_OVERLAY,
  WEATHER_MAP_LAYER_IDS,
  type WeatherMapLayerId,
  type WeatherMapOverlayPreferences,
} from "@/components/map/weather/mapWeatherTypes";
import { LeftRailIconPopoverTrigger } from "./LeftRailIconPopoverTrigger";
import { LeftRailPopoverContent } from "./LeftRailPopoverContent";

const WEATHER_LAYER_META: Record<
  WeatherMapLayerId,
  { label: string; icon: typeof CloudSun; needsOwm: boolean }
> = {
  none: { label: "Desligado", icon: CloudSun, needsOwm: false },
  radar: { label: "Radar", icon: Droplets, needsOwm: false },
  owm_wind: { label: "Vento", icon: Wind, needsOwm: true },
  owm_clouds: { label: "Nuvens", icon: CloudSun, needsOwm: true },
  owm_precipitation: { label: "Chuva", icon: Droplets, needsOwm: true },
  owm_temp: { label: "Temp.", icon: Thermometer, needsOwm: true },
};

const MAP_PROVIDERS: { id: MapProvider; label: string }[] = [
  { id: "leaflet", label: "Leaflet" },
  { id: "mapbox", label: "Mapbox" },
  { id: "google", label: "Google Maps" },
];

function clampOpacity(n: number): number {
  if (Number.isNaN(n)) return DEFAULT_WEATHER_MAP_OVERLAY.opacity;
  return Math.min(0.95, Math.max(0.22, n));
}

type MapLayersPopoverProps = {
  deviceTier: DeviceTier;
  overlay: WeatherMapOverlayPreferences;
  setOverlay: (
    next:
      | WeatherMapOverlayPreferences
      | ((prev: WeatherMapOverlayPreferences) => WeatherMapOverlayPreferences),
  ) => void;
  openWeatherApiKey: string;
  radarStatus: RadarOverlayStatus;
  radarMessage?: string;
};

export function MapLayersPopover({
  deviceTier,
  overlay,
  setOverlay,
  openWeatherApiKey,
  radarStatus,
  radarMessage,
}: MapLayersPopoverProps) {
  const [open, setOpen] = useState(false);

  const baseLayer = useFlightStore((s) => s.plannerBaseLayer);
  const setPlannerBaseLayer = useFlightStore((s) => s.setPlannerBaseLayer);
  const { provider, mode: mapMode, setProvider, setMode: setMapMode } = useMapEngine();

  const setLayer = useCallback(
    (layerId: WeatherMapLayerId) => setOverlay((prev) => ({ ...prev, layerId })),
    [setOverlay],
  );

  const setOpacity = useCallback(
    (opacity: number) => setOverlay((prev) => ({ ...prev, opacity })),
    [setOverlay],
  );

  const owmReady = openWeatherApiKey.length > 0;
  const weatherActive = overlay.layerId !== "none";
  const radarBusy =
    overlay.layerId === "radar" &&
    (radarStatus === "loading" || radarStatus === "idle");
  const radarFailed = overlay.layerId === "radar" && radarStatus === "error";

  const map3dHint =
    deviceTier === "low" || deviceTier === "none"
      ? "Seu dispositivo pode nao suportar visualizacao 3D com performance adequada."
      : undefined;

  return (
    <Popover.Root open={open} onOpenChange={setOpen} modal>
      <LeftRailIconPopoverTrigger
        deviceTier={deviceTier}
        open={open}
        title="Estilo do mapa e clima"
        aria-label="Abrir configuracoes de camadas: estilo do mapa e clima"
        icon={Layers}
      />
      <LeftRailPopoverContent deviceTier={deviceTier} maxHeight="32rem">

        {/* ── Estilo do mapa ── */}
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
          Estilo do mapa
        </p>
        <div className="flex flex-col gap-1">
          {PLANNER_BASE_LAYER_IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setPlannerBaseLayer(id);
                setOpen(false);
              }}
              className={cn(
                "w-full touch-manipulation rounded-lg border px-3 py-2.5 text-left text-xs font-medium transition",
                baseLayer === id
                  ? "border-primary-500/40 bg-primary-500/12 text-white"
                  : "border-white/10 bg-white/[0.04] text-neutral-300 hover:bg-white/[0.08] hover:text-white",
              )}
            >
              {getPlannerBaseLayerConfig(id).label}
            </button>
          ))}
        </div>

        {/* ── Provedor ── */}
        <p className="mb-2 mt-3 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
          Provedor
        </p>
        <div className="flex flex-col gap-1">
          {MAP_PROVIDERS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setProvider(id);
                setOpen(false);
              }}
              className={cn(
                "w-full touch-manipulation rounded-lg border px-3 py-2.5 text-left text-xs font-medium transition",
                provider === id
                  ? "border-primary-500/40 bg-primary-500/12 text-white"
                  : "border-white/10 bg-white/[0.04] text-neutral-300 hover:bg-white/[0.08] hover:text-white",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── 2D / 3D ── */}
        <div className="mt-3 flex items-center gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            2D / 3D
          </p>
          {provider === "leaflet" ? (
            <Lock className="size-3.5 shrink-0 text-neutral-500" aria-hidden />
          ) : null}
        </div>
        <div className="mt-1.5 flex gap-1">
          <button
            type="button"
            disabled={provider === "leaflet"}
            onClick={() => setMapMode("2d")}
            className={cn(
              "touch-manipulation flex-1 rounded-lg border px-2 py-2 text-[11px] font-medium transition",
              mapMode === "2d"
                ? "border-primary-500/40 bg-primary-500/12 text-white"
                : "border-white/10 bg-white/[0.04] text-neutral-300 hover:bg-white/[0.08]",
              provider === "leaflet" &&
                "cursor-not-allowed opacity-40 hover:bg-white/[0.04]",
            )}
          >
            2D
          </button>
          <button
            type="button"
            disabled={provider === "leaflet" || deviceTier === "none"}
            onClick={() => setMapMode("3d")}
            title={map3dHint}
            className={cn(
              "touch-manipulation flex-1 rounded-lg border px-2 py-2 text-[11px] font-medium transition",
              mapMode === "3d"
                ? "border-primary-500/40 bg-primary-500/12 text-white"
                : "border-white/10 bg-white/[0.04] text-neutral-300 hover:bg-white/[0.08]",
              (provider === "leaflet" || deviceTier === "none") &&
                "cursor-not-allowed opacity-40 hover:bg-white/[0.04]",
            )}
          >
            3D
          </button>
        </div>

        {/* ── Separador ── */}
        <div className="my-3.5 h-px bg-white/[0.08]" />

        {/* ── Clima no mapa ── */}
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
          Clima no mapa
        </p>
        <div
          className="mb-3 grid grid-cols-2 gap-1.5"
          role="radiogroup"
          aria-label="Tipo de camada meteorologica"
        >
          {WEATHER_MAP_LAYER_IDS.map((id) => {
            const meta = WEATHER_LAYER_META[id];
            const Icon = meta.icon;
            const disabledOwm = meta.needsOwm && !owmReady;
            const selected = overlay.layerId === id;
            const showSpinner = id === "radar" && selected && radarBusy;

            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabledOwm}
                title={
                  disabledOwm
                    ? "Configure a chave OpenWeather em Ajustes"
                    : undefined
                }
                onClick={() => setLayer(id)}
                className={cn(
                  "touch-manipulation flex min-h-[2.75rem] flex-col items-start gap-0.5 rounded-xl border px-2.5 py-2 text-left text-[11px] font-medium transition",
                  selected
                    ? "border-sky-400/45 bg-sky-400/12 text-white"
                    : "border-white/10 bg-white/[0.04] text-neutral-300 hover:border-white/[0.18] hover:bg-white/[0.07]",
                  disabledOwm &&
                    "cursor-not-allowed opacity-45 hover:border-white/10 hover:bg-white/[0.04]",
                )}
              >
                <span className="flex w-full items-center gap-1.5">
                  {showSpinner ? (
                    <Loader2
                      className="size-3.5 shrink-0 animate-spin text-sky-300"
                      aria-hidden
                    />
                  ) : (
                    <Icon className="size-3.5 shrink-0 opacity-90" aria-hidden />
                  )}
                  <span className="leading-tight">{meta.label}</span>
                </span>
                {disabledOwm ? (
                  <span className="text-[10px] font-normal text-amber-200/80">
                    Requer chave OWM
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {radarFailed && radarMessage ? (
          <p className="mb-3 rounded-lg border border-red-500/25 bg-red-950/40 px-2.5 py-2 text-[11px] text-red-200/95">
            {radarMessage}
          </p>
        ) : null}

        <div
          className={cn(
            "space-y-2",
            !weatherActive && "pointer-events-none opacity-40",
          )}
        >
          <div className="flex items-center justify-between gap-2 text-[10px] font-medium uppercase tracking-wide text-neutral-500">
            <span>Opacidade</span>
            <span className="tabular-nums text-neutral-300">
              {Math.round(clampOpacity(overlay.opacity) * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={22}
            max={95}
            step={1}
            disabled={!weatherActive}
            value={Math.round(clampOpacity(overlay.opacity) * 100)}
            onChange={(e) => setOpacity(Number(e.target.value) / 100)}
            className="h-2 w-full cursor-pointer accent-sky-400 disabled:cursor-not-allowed"
          />
        </div>

        {!owmReady ? (
          <p className="mt-3 text-[10px] leading-relaxed text-neutral-500">
            Camadas OWM requerem chave em{" "}
            <Link
              to={toWorkspace("/", { panel: "settings" })}
              className="font-medium text-sky-300/90 underline-offset-2 hover:underline"
              onClick={() => setOpen(false)}
            >
              Ajustes
            </Link>
            .
          </p>
        ) : null}

        {weatherActive ? (
          <button
            type="button"
            className="mt-3 w-full touch-manipulation rounded-xl border border-white/10 py-2 text-center text-xs font-medium text-neutral-400 transition hover:bg-white/[0.06] hover:text-white"
            onClick={() => setOverlay(DEFAULT_WEATHER_MAP_OVERLAY)}
          >
            Limpar camada de clima
          </button>
        ) : null}
      </LeftRailPopoverContent>
    </Popover.Root>
  );
}
