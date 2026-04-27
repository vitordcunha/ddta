import { memo, type ReactNode } from "react";
import { Check, Cloud, Moon, Sun, TriangleAlert, Umbrella } from "lucide-react";
import { getSolarArcIllustrationDot } from "@/features/flight-planner/utils/solarPosition";
import {
  windDegToCompass,
  wmoCodeToConditionPt,
} from "@/features/flight-planner/utils/weatherHelpers";
import type { FlightAssessment, WeatherData } from "@/features/flight-planner/types";
import { maybeBackdropBlur, useDeviceTier } from "@/lib/deviceUtils";
import { cn } from "@/lib/utils";

export function formatForecastHourLabel(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const Stat = memo(function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
}) {
  const tier = useDeviceTier();
  return (
    <div className={cn("glass-stat", maybeBackdropBlur(tier, "sm"))}>
      <p className="mb-1 inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-neutral-500">
        {icon}
        {label}
      </p>
      <p className="text-sm font-medium text-neutral-100">{value}</p>
    </div>
  );
});

export const WeatherHero = memo(function WeatherHero({
  weather,
  assessment,
}: {
  weather: WeatherData;
  assessment: FlightAssessment | null;
}) {
  const condition =
    weather.conditionLabel ?? wmoCodeToConditionPt(weather.weatherCode ?? 0);
  const isNight = weather.isDay === false;
  const go = assessment?.go ?? true;

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.05] to-transparent">
      <div className="flex items-stretch">
        <div className="flex flex-col items-center justify-center gap-1 border-r border-white/[0.08] px-4 py-3">
          {isNight ? (
            <Moon className="size-5 text-blue-300/80" />
          ) : (
            <Sun className="size-5 text-amber-300/90" />
          )}
          <span className="font-mono text-2xl font-bold tabular-nums text-white">
            {Math.round(weather.temperatureC)}°
          </span>
          {weather.apparentTemperatureC != null && (
            <span className="text-[10px] text-neutral-500">
              sens. {Math.round(weather.apparentTemperatureC)}°
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col justify-center gap-1.5 px-3 py-3">
          <p className="text-sm font-medium text-neutral-200">{condition}</p>

          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/10 bg-white/[0.06]"
              title={`Direção: ${Math.round(weather.windDirectionDeg)}°`}
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                style={{ transform: `rotate(${weather.windDirectionDeg}deg)` }}
              >
                <path
                  d="M5 0 L3 10 L5 8 L7 10 Z"
                  fill="currentColor"
                  className="text-sky-300"
                />
              </svg>
            </span>
            <span className="text-xs text-neutral-300">
              {windDegToCompass(weather.windDirectionDeg)} ·{" "}
              {weather.windSpeedMs.toFixed(1)} m/s
              {weather.windGustsMs != null &&
                weather.windGustsMs > weather.windSpeedMs + 2 && (
                  <span className="text-amber-300/80">
                    {" "}
                    (rajadas {weather.windGustsMs.toFixed(1)})
                  </span>
                )}
            </span>
          </div>

          {weather.rainMmH > 0.05 || weather.isPrecipitatingNow ? (
            <div className="flex items-center gap-1.5 text-[11px] text-sky-300/90">
              <Umbrella className="size-3 shrink-0" />
              <span>
                {weather.isPrecipitatingNow
                  ? "Precipitação agora"
                  : `${weather.rainMmH.toFixed(2)} mm/h`}
              </span>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-center border-l border-white/[0.08] px-3">
          <div
            className={cn(
              "flex h-10 w-10 flex-col items-center justify-center rounded-xl text-center",
              go
                ? "bg-primary-500/15 ring-1 ring-primary-500/30"
                : "bg-red-500/15 ring-1 ring-red-500/30",
            )}
          >
            {go ? (
              <Check className="size-4 text-primary-400" />
            ) : (
              <TriangleAlert className="size-4 text-red-400" />
            )}
            <span
              className={cn(
                "text-[8px] font-bold uppercase tracking-wide",
                go ? "text-primary-400" : "text-red-400",
              )}
            >
              {go ? "GO" : "NO"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});

export const SolarArc = memo(function SolarArc({
  weather,
  lat,
  lon,
  when,
}: {
  weather: WeatherData | null;
  lat: number;
  lon: number;
  when: Date;
}) {
  const cloudPct = weather?.cloudCoveragePct ?? 0;
  const isGoodLight = cloudPct < 70 && weather?.isDay !== false;
  const dot = getSolarArcIllustrationDot(lat, lon, when);
  const sunBelow = dot.elevationDeg < -4;

  return (
    <div className="flex items-center justify-center py-2">
      <svg width="180" height="90" viewBox="0 0 180 90" fill="none" aria-hidden>
        <line
          x1="10"
          y1="82"
          x2="170"
          y2="82"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
        />
        <path
          d="M 15 82 A 75 75 0 0 1 165 82"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="1"
          fill="none"
        />
        <path
          d="M 15 82 A 75 75 0 0 1 58 20"
          stroke="rgba(251,191,36,0.25)"
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M 122 20 A 75 75 0 0 1 165 82"
          stroke="rgba(251,191,36,0.25)"
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M 58 20 A 75 75 0 0 1 122 20"
          stroke={
            isGoodLight ? "rgba(62,207,142,0.45)" : "rgba(62,207,142,0.2)"
          }
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
        />
        {!sunBelow ? (
          <>
            <circle
              cx={dot.cx}
              cy={dot.cy}
              r="7"
              fill="rgba(251,191,36,0.15)"
            />
            <circle cx={dot.cx} cy={dot.cy} r="4" fill="rgba(251,191,36,0.9)" />
            <circle cx={dot.cx} cy={dot.cy} r="2" fill="white" opacity="0.8" />
          </>
        ) : (
          <>
            <circle
              cx={dot.cx}
              cy={dot.cy}
              r="5"
              fill="rgba(147,197,253,0.7)"
            />
            <circle
              cx={dot.cx}
              cy={dot.cy}
              r="2.5"
              fill="white"
              opacity="0.6"
            />
          </>
        )}
        <text
          x="10"
          y="79"
          fontSize="8"
          fill="rgba(255,255,255,0.25)"
          fontFamily="monospace"
        >
          L
        </text>
        <text
          x="162"
          y="79"
          fontSize="8"
          fill="rgba(255,255,255,0.25)"
          fontFamily="monospace"
        >
          O
        </text>
        <text
          x="82"
          y="10"
          fontSize="7"
          fill="rgba(251,191,36,0.5)"
          fontFamily="monospace"
        >
          ☀
        </text>
      </svg>

      <div className="ml-3 space-y-1.5 text-[10px]">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-4 rounded-full bg-amber-400/35" />
          <span className="text-neutral-500">Hora dourada</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className={cn(
              "h-2 w-4 rounded-full",
              isGoodLight ? "bg-primary-500/55" : "bg-primary-500/20",
            )}
          />
          <span className="text-neutral-500">Janela ideal</span>
        </div>
        {cloudPct > 0 && (
          <div className="flex items-center gap-1 text-neutral-500">
            <Cloud className="size-3" />
            <span>{Math.round(cloudPct)}% nuvens</span>
          </div>
        )}
      </div>
    </div>
  );
});

export const SolarArcEmpty = memo(function SolarArcEmpty() {
  return (
    <svg width="120" height="60" viewBox="0 0 120 60" fill="none" aria-hidden>
      <line
        x1="5"
        y1="55"
        x2="115"
        y2="55"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth="1"
      />
      <path
        d="M 8 55 A 52 52 0 0 1 112 55"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth="1"
        fill="none"
      />
      <circle
        cx="60"
        cy="10"
        r="8"
        fill="rgba(255,255,255,0.05)"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="1"
        strokeDasharray="2 2"
      />
    </svg>
  );
});
