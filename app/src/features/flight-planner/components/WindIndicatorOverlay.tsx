import { useFlightStore } from "@/features/flight-planner/stores/useFlightStore";
import { windDegToCompass } from "@/features/flight-planner/utils/weatherHelpers";

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

  if (!weather) return null;

  const { windDirectionDeg, windSpeedMs, windGustsMs } = weather;
  const color = windColor(
    assessment?.issues ?? [],
    assessment?.warnings ?? [],
  );
  const cv = COLOR_VARS[color];
  const cardinal = windDegToCompass(windDirectionDeg);

  return (
    <div className="pointer-events-none">
      <div
        className="flex flex-col items-center gap-1 rounded-xl px-2 pb-2 pt-1.5 select-none"
        style={{
          background: "rgba(10,10,10,0.75)",
          backdropFilter: "blur(6px)",
          border: `1px solid ${cv.border}`,
          boxShadow: `0 0 14px ${cv.glow}`,
          width: 74,
        }}
      >
        {/* Compass SVG */}
        <div className="relative" style={{ width: 56, height: 56 }}>
          <svg
            width={56}
            height={56}
            viewBox="0 0 56 56"
            aria-hidden="true"
            style={{ display: "block" }}
          >
            {/* Outer ring */}
            <circle
              cx={28}
              cy={28}
              r={25}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={1}
            />
            {/* Tick marks at 45° intervals */}
            {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
              const rad = ((a - 90) * Math.PI) / 180;
              const x1 = 28 + 22 * Math.cos(rad);
              const y1 = 28 + 22 * Math.sin(rad);
              const x2 = 28 + 25 * Math.cos(rad);
              const y2 = 28 + 25 * Math.sin(rad);
              return (
                <line
                  key={a}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="rgba(255,255,255,0.22)"
                  strokeWidth={1}
                />
              );
            })}
            {/* Cardinal labels */}
            {(
              [
                { label: "N", angle: 0 },
                { label: "L", angle: 90 },
                { label: "S", angle: 180 },
                { label: "O", angle: 270 },
              ] as const
            ).map(({ label, angle }) => {
              const rad = ((angle - 90) * Math.PI) / 180;
              const x = 28 + 16.5 * Math.cos(rad);
              const y = 28 + 16.5 * Math.sin(rad) + 0.5;
              return (
                <text
                  key={label}
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={7}
                  fontFamily="system-ui, sans-serif"
                  fontWeight={label === "N" ? "700" : "500"}
                  fill={label === "N" ? cv.arrow : "rgba(255,255,255,0.45)"}
                >
                  {label}
                </text>
              );
            })}
            {/* Wind direction arrow — rotates around center.
                Arrow points FROM the direction wind is coming (wind vane convention).
                windDirectionDeg=0 (from N) → arrow points up. */}
            <g
              transform={`rotate(${windDirectionDeg}, 28, 28)`}
              aria-label={`Vento de ${cardinal}`}
            >
              {/* Shaft */}
              <line
                x1={28}
                y1={28}
                x2={28}
                y2={8}
                stroke={cv.arrow}
                strokeWidth={2.5}
                strokeLinecap="round"
              />
              {/* Arrowhead */}
              <polygon
                points="28,4 24,11 32,11"
                fill={cv.arrow}
              />
              {/* Tail feather */}
              <line
                x1={28}
                y1={34}
                x2={28}
                y2={28}
                stroke={cv.arrow}
                strokeWidth={1.5}
                strokeLinecap="round"
                opacity={0.5}
              />
            </g>
            {/* Center dot */}
            <circle cx={28} cy={28} r={3} fill={cv.arrow} opacity={0.9} />
          </svg>
        </div>

        {/* Speed */}
        <span
          className="text-center font-mono font-semibold leading-none"
          style={{ fontSize: 13, color: cv.text }}
        >
          {windSpeedMs.toFixed(1)}{" "}
          <span style={{ fontSize: 9, fontWeight: 400, color: "rgba(255,255,255,0.55)" }}>
            m/s
          </span>
        </span>

        {/* Gusts (if significantly higher) */}
        {windGustsMs && windGustsMs > windSpeedMs + 1 ? (
          <span
            className="leading-none"
            style={{ fontSize: 9, color: "rgba(255,255,255,0.45)" }}
          >
            raj. {windGustsMs.toFixed(1)} m/s
          </span>
        ) : null}

        {/* Cardinal direction */}
        <span
          className="leading-none tracking-wider"
          style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}
        >
          de {cardinal}
        </span>
      </div>
    </div>
  );
}
