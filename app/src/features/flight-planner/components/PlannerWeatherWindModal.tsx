import * as Dialog from "@radix-ui/react-dialog";
import {
  AlertTriangle,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Droplets,
  Gauge,
  Info,
  Moon,
  Snowflake,
  Sun,
  Thermometer,
  Wind,
  X,
} from "lucide-react";
import { useId, type ReactNode } from "react";
import type { FlightAssessment, WeatherData } from "@/features/flight-planner/types";
import { cn } from "@/lib/utils";
import {
  beaufortForceLabelPt,
  windDegToCompass,
  windSpeedToBeaufort,
  wmoCodeToConditionPt,
} from "@/features/flight-planner/utils/weatherHelpers";
import { WindCompassDial } from "@/features/flight-planner/components/WindCompassDial";

const fmt = (n: number, d: number) => n.toFixed(d).replace(".", ",");

function weatherHeroIcon(code: number | undefined, isDay: boolean | undefined): ReactNode {
  const c = code ?? 0;
  const day = isDay !== false;
  const common = "size-[4.5rem] shrink-0 drop-shadow-[0_8px_24px_rgba(0,0,0,0.35)]";
  if (c === 0 || c === 1)
    return day ? (
      <Sun className={cn(common, "text-amber-300")} strokeWidth={1.25} />
    ) : (
      <Moon className={cn(common, "text-indigo-200")} strokeWidth={1.25} />
    );
  if (c === 2) return <CloudSun className={cn(common, "text-sky-200")} strokeWidth={1.25} />;
  if (c === 3) return <Cloud className={cn(common, "text-slate-300")} strokeWidth={1.25} />;
  if (c === 45 || c === 48) return <CloudFog className={cn(common, "text-slate-400")} strokeWidth={1.25} />;
  if (c >= 51 && c <= 57)
    return <CloudDrizzle className={cn(common, "text-sky-300")} strokeWidth={1.25} />;
  if (c >= 61 && c <= 67)
    return <CloudRain className={cn(common, "text-sky-400")} strokeWidth={1.25} />;
  if (c >= 71 && c <= 77)
    return <Snowflake className={cn(common, "text-cyan-200")} strokeWidth={1.25} />;
  if (c >= 80 && c <= 86)
    return <CloudRain className={cn(common, "text-sky-400")} strokeWidth={1.25} />;
  if (c >= 95)
    return <CloudLightning className={cn(common, "text-violet-300")} strokeWidth={1.25} />;
  return <CloudSun className={cn(common, "text-sky-200")} strokeWidth={1.25} />;
}

function MetricTile({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-white/[0.08] bg-white/[0.04] p-3">
      <div className="flex items-center gap-2 text-neutral-500">
        <span className="text-neutral-400 [&_svg]:size-4">{icon}</span>
        <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-base font-semibold tabular-nums tracking-tight text-neutral-100">{value}</p>
      {hint ? <p className="text-xs leading-snug text-neutral-500">{hint}</p> : null}
    </div>
  );
}

export type PlannerWeatherWindModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weather: WeatherData;
  assessment: FlightAssessment | null;
};

export function PlannerWeatherWindModal({
  open,
  onOpenChange,
  weather,
  assessment,
}: PlannerWeatherWindModalProps) {
  const titleId = useId();
  const descId = useId();
  const code = weather.weatherCode ?? 0;
  const condition =
    weather.conditionLabel?.trim() || wmoCodeToConditionPt(code);
  const cardinal = windDegToCompass(weather.windDirectionDeg);
  const bft = windSpeedToBeaufort(weather.windSpeedMs);
  const bftLabel = beaufortForceLabelPt(bft);
  const windKmh = weather.windSpeedMs * 3.6;
  const gustKmh =
    weather.windGustsMs != null ? weather.windGustsMs * 3.6 : null;
  const hourly = weather.hourlyForecast?.slice(0, 12) ?? [];

  const accent =
    assessment?.issues.some(
      (s) => s.includes("Vento") || s.includes("Rajada") || s.includes("rajada"),
    )
      ? "#f87171"
      : assessment?.warnings.some(
            (s) => s.includes("Vento") || s.includes("Rajada") || s.includes("rajada"),
          )
        ? "#fbbf24"
        : "#38bdf8";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-[200] bg-black/65 backdrop-blur-md"
          onClick={() => onOpenChange(false)}
        />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-[201] flex max-h-[min(90dvh,820px)] w-[min(92vw,26rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0f1218] shadow-[0_24px_80px_rgba(0,0,0,0.55)] outline-none animate-fade-up",
          )}
          aria-labelledby={titleId}
          aria-describedby={descId}
        >
          {/* Hero */}
          <div
            className="relative shrink-0 overflow-hidden px-5 pb-6 pt-5"
            style={{
              background: `linear-gradient(145deg, rgba(56,189,248,0.18) 0%, rgba(15,18,24,0.95) 42%, #0f1218 100%)`,
            }}
          >
            <div
              className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full opacity-40 blur-3xl"
              style={{ background: `radial-gradient(circle, ${accent}55 0%, transparent 70%)` }}
            />
            <div className="relative flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-start gap-4">
                <div className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/20">
                  {weatherHeroIcon(weather.weatherCode, weather.isDay)}
                </div>
                <div className="min-w-0 pt-0.5">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-sky-200/80">
                    Clima na área
                  </p>
                  <Dialog.Title
                    id={titleId}
                    className="mt-1 text-lg font-semibold leading-snug tracking-tight text-white"
                  >
                    {condition}
                  </Dialog.Title>
                  <p id={descId} className="mt-1.5 text-sm text-neutral-400">
                    {fmt(weather.temperatureC, 1)} °C
                    {weather.apparentTemperatureC != null ? (
                      <span className="text-neutral-500">
                        {" "}
                        · sensação {fmt(weather.apparentTemperatureC, 1)} °C
                      </span>
                    ) : null}
                  </p>
                </div>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="shrink-0 rounded-xl border border-white/10 bg-black/25 p-2 text-neutral-400 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
                  aria-label="Fechar"
                >
                  <X className="size-4" />
                </button>
              </Dialog.Close>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-5 pt-1">
            {/* Vento — destaque visual */}
            <section className="mb-4 rounded-2xl border border-sky-500/20 bg-gradient-to-b from-sky-500/[0.08] to-transparent p-4">
              <div className="flex items-center gap-2 text-sky-300/90">
                <Wind className="size-4" aria-hidden />
                <h3 className="text-xs font-semibold uppercase tracking-wider">Vento</h3>
              </div>
              <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-center sm:gap-8">
                <div className="shrink-0">
                  <WindCompassDial
                    sizePx={112}
                    windDirectionDeg={weather.windDirectionDeg}
                    accentColor={accent}
                  />
                </div>
                <div className="w-full max-w-[14rem] space-y-3 text-center sm:text-left">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                      Direção (de onde sopra)
                    </p>
                    <p className="text-xl font-semibold text-white">
                      {cardinal}{" "}
                      <span className="text-base font-normal text-neutral-400">
                        ({Math.round(weather.windDirectionDeg)}°)
                      </span>
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-black/30 px-3 py-2">
                      <p className="text-[10px] uppercase text-neutral-500">Velocidade</p>
                      <p className="font-mono text-lg font-semibold tabular-nums text-sky-200">
                        {fmt(weather.windSpeedMs, 1)}{" "}
                        <span className="text-xs font-normal text-neutral-500">m/s</span>
                      </p>
                      <p className="text-[11px] text-neutral-500">{fmt(windKmh, 0)} km/h</p>
                    </div>
                    <div className="rounded-lg bg-black/30 px-3 py-2">
                      <p className="text-[10px] uppercase text-neutral-500">Rajadas</p>
                      <p className="font-mono text-lg font-semibold tabular-nums text-neutral-100">
                        {weather.windGustsMs != null ? (
                          <>
                            {fmt(weather.windGustsMs, 1)}{" "}
                            <span className="text-xs font-normal text-neutral-500">m/s</span>
                          </>
                        ) : (
                          <span className="text-neutral-500">—</span>
                        )}
                      </p>
                      <p className="text-[11px] text-neutral-500">
                        {gustKmh != null ? `${fmt(gustKmh, 0)} km/h` : " "}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2">
                    <p className="text-[10px] uppercase text-neutral-500">Escala Beaufort</p>
                    <p className="text-sm font-medium text-neutral-200">
                      Força {bft} — {bftLabel}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Métricas ambiente */}
            <section className="mb-4">
              <h3 className="mb-2 flex items-center gap-2 px-0.5 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                <Thermometer className="size-3.5" aria-hidden />
                Ambiente
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <MetricTile
                  icon={<Cloud className="size-4" />}
                  label="Nuvens"
                  value={`${Math.round(weather.cloudCoveragePct)} %`}
                />
                <MetricTile
                  icon={<Droplets className="size-4" />}
                  label="Humidade"
                  value={
                    weather.relativeHumidityPct != null
                      ? `${Math.round(weather.relativeHumidityPct)} %`
                      : "—"
                  }
                />
                <MetricTile
                  icon={<Gauge className="size-4" />}
                  label="Pressão"
                  value={
                    weather.pressureHpa != null ? `${fmt(weather.pressureHpa, 1)} hPa` : "—"
                  }
                />
                <MetricTile
                  icon={<Droplets className="size-4 text-sky-400" />}
                  label="Precip. (total)"
                  value={`${fmt(weather.rainMmH, 2)} mm/h`}
                  hint={
                    weather.isPrecipitatingNow
                      ? "Precipitação no momento"
                      : weather.rainMmH < 0.05
                        ? "Volume muito baixo"
                        : undefined
                  }
                />
              </div>
              {(weather.rainMmHRaw != null || weather.showersMmH != null) && (
                <div
                  className={cn(
                    "mt-2 grid gap-2",
                    weather.rainMmHRaw != null && weather.showersMmH != null
                      ? "grid-cols-2"
                      : "grid-cols-1",
                  )}
                >
                  {weather.rainMmHRaw != null ? (
                    <MetricTile
                      icon={<CloudRain className="size-4" />}
                      label="Chuva (rain)"
                      value={`${fmt(weather.rainMmHRaw, 2)} mm/h`}
                    />
                  ) : null}
                  {weather.showersMmH != null ? (
                    <MetricTile
                      icon={<CloudDrizzle className="size-4" />}
                      label="Aguaceiros"
                      value={`${fmt(weather.showersMmH, 2)} mm/h`}
                    />
                  ) : null}
                </div>
              )}
            </section>

            {/* Horas */}
            {hourly.length > 0 ? (
              <section className="mb-4">
                <h3 className="mb-2 px-0.5 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Próximas horas
                </h3>
                <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 pt-0.5">
                  {hourly.map((h) => {
                    const t = h.time.slice(11, 16);
                    return (
                      <div
                        key={h.time}
                        className="flex min-w-[4.25rem] flex-col items-center gap-1 rounded-xl border border-white/[0.07] bg-white/[0.03] px-2 py-2.5"
                        title={wmoCodeToConditionPt(h.weatherCode)}
                      >
                        <span className="text-[10px] font-medium text-neutral-500">{t}</span>
                        <span className="font-mono text-sm font-semibold text-neutral-100">
                          {fmt(h.tempC, 0)}°
                        </span>
                        <span className="text-[10px] text-sky-300/90">{h.precipProbPct}%</span>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {/* Avaliação voo */}
            {assessment &&
            (assessment.issues.length > 0 ||
              assessment.warnings.length > 0 ||
              assessment.tips.length > 0) ? (
              <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  <Info className="size-3.5" aria-hidden />
                  Planeamento
                </h3>
                <ul className="space-y-2 text-sm leading-snug">
                  {assessment.issues.map((t) => (
                    <li
                      key={`i-${t}`}
                      className="flex gap-2 rounded-lg bg-red-500/10 px-2 py-1.5 text-red-200/95"
                    >
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-400" aria-hidden />
                      <span>{t}</span>
                    </li>
                  ))}
                  {assessment.warnings.map((t) => (
                    <li
                      key={`w-${t}`}
                      className="flex gap-2 rounded-lg bg-amber-500/10 px-2 py-1.5 text-amber-100/95"
                    >
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" aria-hidden />
                      <span>{t}</span>
                    </li>
                  ))}
                  {assessment.tips.map((t) => (
                    <li
                      key={`tip-${t}`}
                      className="flex gap-2 text-neutral-400"
                    >
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-sky-500/60" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
