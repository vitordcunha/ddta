import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  CloudSun,
  Droplets,
  Info,
  Loader2,
  Thermometer,
  Wind,
  X,
} from "lucide-react";
import { toWorkspace } from "@/constants/routes";
import { cn } from "@/lib/utils";
import {
  DEFAULT_WEATHER_MAP_OVERLAY,
  WEATHER_MAP_LAYER_IDS,
  type WeatherMapLayerId,
  type WeatherMapOverlayPreferences,
} from "@/components/map/weather/mapWeatherTypes";
import type { RadarOverlayStatus } from "@/components/map/PlannerWeatherMapLayers";

const LAYER_META: Record<
  WeatherMapLayerId,
  {
    label: string;
    description: string;
    icon: typeof CloudSun;
    needsOwm: boolean;
  }
> = {
  none: {
    label: "Desligado",
    description: "Somente o mapa base.",
    icon: CloudSun,
    needsOwm: false,
  },
  radar: {
    label: "Radar (chuva)",
    description: "Precipitacao recente via RainViewer; sem chave de API.",
    icon: Droplets,
    needsOwm: false,
  },
  owm_wind: {
    label: "Vento",
    description: "Camada de vento (OpenWeatherMap).",
    icon: Wind,
    needsOwm: true,
  },
  owm_clouds: {
    label: "Nuvens",
    description: "Cobertura de nuvens.",
    icon: CloudSun,
    needsOwm: true,
  },
  owm_precipitation: {
    label: "Precipitacao",
    description: "Chuva acumulada / intensidade.",
    icon: Droplets,
    needsOwm: true,
  },
  owm_temp: {
    label: "Temperatura",
    description: "Temperatura ao nivel do solo.",
    icon: Thermometer,
    needsOwm: true,
  },
};

export type WeatherLayerPlacement =
  | "planToolbarStack"
  | "mapBottomLeft"
  | "sidebar";

type WeatherLayerMapControlsProps = {
  /** planToolbarStack: acima da toolbar do planeador (z-index do workspace). mapBottomLeft: canto do mapa. */
  placement: WeatherLayerPlacement;
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

export function WeatherLayerMapControls({
  placement,
  overlay,
  setOverlay,
  openWeatherApiKey,
  radarStatus,
  radarMessage,
}: WeatherLayerMapControlsProps) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const setLayer = useCallback(
    (layerId: WeatherMapLayerId) => {
      setOverlay((prev) => ({ ...prev, layerId }));
    },
    [setOverlay],
  );

  const setOpacity = useCallback(
    (opacity: number) => {
      setOverlay((prev) => ({ ...prev, opacity }));
    },
    [setOverlay],
  );

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const el = rootRef.current;
      if (!el?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = overlay.layerId !== "none";
  const owmReady = openWeatherApiKey.length > 0;
  const radarPhase = overlay.layerId === "radar" ? radarStatus : "idle";
  const radarErrMsg = overlay.layerId === "radar" ? radarMessage : undefined;
  const radarBusy =
    overlay.layerId === "radar" &&
    (radarPhase === "loading" || radarPhase === "idle");
  const radarFailed = overlay.layerId === "radar" && radarPhase === "error";

  const panelPositionClass =
    placement === "planToolbarStack"
      ? "top-full left-0 z-[50] mt-2 max-h-[min(28rem,calc(100dvh-9rem))] w-[min(19rem,calc(100vw-2rem-max(1rem,env(safe-area-inset-left,0px))-max(1rem,env(safe-area-inset-right,0px))))] origin-top-left"
      : placement === "sidebar"
        ? "top-0 left-full z-[50] ml-2 max-h-[min(28rem,calc(100dvh-8rem))] w-[min(19rem,calc(100vw-4rem))] origin-top-left"
        : cn(
            "bottom-0 left-full z-[50] ml-2 max-h-[min(28rem,calc(100dvh-8rem))] w-[min(19rem,calc(100vw-3.5rem))] origin-bottom-left",
            "max-sm:bottom-full max-sm:left-0 max-sm:mb-2 max-sm:ml-0",
          );

  return (
    <div
      ref={rootRef}
      className={cn(
        "pointer-events-auto absolute left-0 bottom-[200px] w-12 shrink-0",
      )}
    >
      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Camada meteorologica no mapa"
          className={cn(
            "glass-surface animate-fade-in overflow-y-auto rounded-2xl p-3.5 shadow-xl",
            panelPositionClass,
          )}
        >
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-white">
                Clima no mapa
              </h2>
              <p className="mt-0.5 text-[11px] leading-snug text-[#9a9a9a]">
                Sobreposicao semitransparente para leitura rapida antes do voo.
              </p>
            </div>
            <button
              type="button"
              className="touch-target flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#a3a3a3] transition hover:bg-white/10 hover:text-white"
              onClick={() => setOpen(false)}
              aria-label="Fechar painel de clima"
            >
              <X className="size-4" />
            </button>
          </div>

          <div
            className="mb-3 grid grid-cols-2 gap-1.5"
            role="radiogroup"
            aria-label="Tipo de camada"
          >
            {WEATHER_MAP_LAYER_IDS.map((id) => {
              const meta = LAYER_META[id];
              const Icon = meta.icon;
              const disabledOwm = meta.needsOwm && !owmReady;
              const selected = overlay.layerId === id;
              const isRadarOption = id === "radar";
              const showSpinner = isRadarOption && selected && radarBusy;

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
                      : meta.description
                  }
                  onClick={() => setLayer(id)}
                  className={cn(
                    "touch-target flex min-h-[2.75rem] flex-col items-start gap-0.5 rounded-xl border px-2.5 py-2 text-left text-[11px] font-medium transition",
                    selected
                      ? "border-[rgba(96,165,250,0.45)] bg-[rgba(96,165,250,0.12)] text-white"
                      : "border-white/10 bg-white/[0.04] text-[#c4c4c4] hover:border-white/18 hover:bg-white/[0.07]",
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
                      <Icon
                        className="size-3.5 shrink-0 opacity-90"
                        aria-hidden
                      />
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

          {radarFailed && radarErrMsg ? (
            <p className="mb-3 rounded-lg border border-red-500/25 bg-red-950/40 px-2.5 py-2 text-[11px] text-red-200/95">
              {radarErrMsg}
            </p>
          ) : null}

          <div
            className={cn(
              "space-y-2",
              !active && "pointer-events-none opacity-40",
            )}
          >
            <div className="flex items-center justify-between gap-2 text-[10px] font-medium uppercase tracking-wide text-[#8a8a8a]">
              <span>Opacidade</span>
              <span className="tabular-nums text-[#c6c6c6]">
                {Math.round(clampOpacity(overlay.opacity) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={22}
              max={95}
              step={1}
              disabled={!active}
              value={Math.round(clampOpacity(overlay.opacity) * 100)}
              onChange={(e) => setOpacity(Number(e.target.value) / 100)}
              className="h-2 w-full cursor-pointer accent-sky-400 disabled:cursor-not-allowed"
              aria-valuemin={22}
              aria-valuemax={95}
              aria-valuenow={Math.round(clampOpacity(overlay.opacity) * 100)}
            />
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-xl border border-white/[0.06] bg-black/25 px-2.5 py-2">
            <Info
              className="mt-0.5 size-3.5 shrink-0 text-sky-300/90"
              aria-hidden
            />
            <p className="text-[10px] leading-relaxed text-[#8c8c8c]">
              Radar e gratuito (RainViewer). Camadas OWM usam a chave em{" "}
              <Link
                to={toWorkspace("/", { panel: "settings" })}
                className="font-medium text-sky-300/95 underline-offset-2 hover:underline"
                onClick={() => setOpen(false)}
              >
                Ajustes
              </Link>
              . Dados sao indicativos; confira sempre o briefing oficial.
            </p>
          </div>

          {active ? (
            <button
              type="button"
              className="mt-3 w-full touch-target rounded-xl border border-white/10 py-2 text-center text-xs font-medium text-[#b0b0b0] transition hover:bg-white/[0.06] hover:text-white"
              onClick={() => setOverlay(DEFAULT_WEATHER_MAP_OVERLAY)}
            >
              Limpar camada
            </button>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        className={cn(
          "touch-target relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-white/15 bg-[#121212]/90 text-[#e8e8e8] shadow-lg backdrop-blur-md transition",
          "hover:border-white/25 hover:bg-[#1a1a1a]/95 active:bg-white/10",
          active && "border-sky-400/40 ring-2 ring-sky-500/25",
        )}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((o) => !o)}
        title="Camada meteorologica"
      >
        <CloudSun
          className={cn("size-5", active ? "text-sky-300" : "text-[#e8e8e8]")}
          aria-hidden
        />
        {active ? (
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.75)]" />
        ) : null}
      </button>
    </div>
  );
}

function clampOpacity(n: number): number {
  if (Number.isNaN(n)) return DEFAULT_WEATHER_MAP_OVERLAY.opacity;
  return Math.min(0.95, Math.max(0.22, n));
}
