import { useState } from "react";
import { useFlightStore } from "@/features/flight-planner/stores/useFlightStore";
import { windDegToCompass } from "@/features/flight-planner/utils/weatherHelpers";
import { WindCompassDial } from "@/features/flight-planner/components/WindCompassDial";
import { PlannerWeatherWindModal } from "@/features/flight-planner/components/PlannerWeatherWindModal";

function windColor(
  issues: string[],
  warnings: string[],
): "green" | "amber" | "red" {
  const isWindIssue = (s: string) =>
    s.includes("Vento") || s.includes("Rajada") || s.includes("rajada");
  if (issues.some(isWindIssue)) return "red";
  if (warnings.some(isWindIssue)) return "amber";
  return "green";
}

const COLOR_VARS = {
  green: {
    arrow: "#3ecf8e",
    border: "rgba(62,207,142,0.45)",
    text: "#3ecf8e",
    glow: "rgba(62,207,142,0.18)",
  },
  amber: {
    arrow: "#fbbf24",
    border: "rgba(251,191,36,0.45)",
    text: "#fbbf24",
    glow: "rgba(251,191,36,0.14)",
  },
  red: {
    arrow: "#f87171",
    border: "rgba(248,113,113,0.45)",
    text: "#f87171",
    glow: "rgba(248,113,113,0.14)",
  },
} as const;

export function WindIndicatorOverlay() {
  const weather = useFlightStore((s) => s.weather);
  const assessment = useFlightStore((s) => s.assessment);
  const [detailOpen, setDetailOpen] = useState(false);

  if (!weather) return null;

  const { windDirectionDeg, windSpeedMs, windGustsMs } = weather;
  const color = windColor(
    assessment?.issues ?? [],
    assessment?.warnings ?? [],
  );
  const cv = COLOR_VARS[color];
  const cardinal = windDegToCompass(windDirectionDeg);

  return (
    <>
      <div className="pointer-events-none">
        <button
          type="button"
          className="pointer-events-auto flex cursor-pointer flex-col items-center gap-1 rounded-xl px-2 pb-2 pt-1.5 text-left outline-none ring-sky-400/50 transition hover:brightness-110 focus-visible:ring-2 active:scale-[0.98]"
          style={{
            background: "rgba(10,10,10,0.75)",
            backdropFilter: "blur(6px)",
            border: `1px solid ${cv.border}`,
            boxShadow: `0 0 14px ${cv.glow}`,
            width: 74,
          }}
          aria-haspopup="dialog"
          aria-expanded={detailOpen}
          aria-label={`Clima e vento: ${cardinal}, ${windSpeedMs.toFixed(1)} metros por segundo. Toque para mais detalhes.`}
          title="Clima, vento e previsão"
          onClick={() => setDetailOpen(true)}
        >
          <div className="relative" style={{ width: 56, height: 56 }}>
            <WindCompassDial
              sizePx={56}
              windDirectionDeg={windDirectionDeg}
              accentColor={cv.arrow}
            />
          </div>

          <span
            className="text-center font-mono font-semibold leading-none"
            style={{ fontSize: 13, color: cv.text }}
            aria-hidden
          >
            {windSpeedMs.toFixed(1)}{" "}
            <span style={{ fontSize: 9, fontWeight: 400, color: "rgba(255,255,255,0.55)" }}>
              m/s
            </span>
          </span>

          {windGustsMs && windGustsMs > windSpeedMs + 1 ? (
            <span
              className="leading-none"
              style={{ fontSize: 9, color: "rgba(255,255,255,0.45)" }}
              aria-hidden
            >
              raj. {windGustsMs.toFixed(1)} m/s
            </span>
          ) : null}

          <span
            className="leading-none tracking-wider"
            style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}
            aria-hidden
          >
            de {cardinal}
          </span>
        </button>
      </div>

      <PlannerWeatherWindModal
        open={detailOpen}
        onOpenChange={setDetailOpen}
        weather={weather}
        assessment={assessment}
      />
    </>
  );
}
