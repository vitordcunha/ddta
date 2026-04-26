type WindCompassDialProps = {
  /** Largura/altura em px; geometria interna fixa 56×56. */
  sizePx: number;
  windDirectionDeg: number;
  accentColor: string;
  cardinalColorDim?: string;
  cardinalColorNorth?: string;
};

/**
 * Rosa dos ventos com seta na direção de onde o vento sopra (convenção meteorológica).
 */
export function WindCompassDial({
  sizePx,
  windDirectionDeg,
  accentColor,
  cardinalColorDim = "rgba(255,255,255,0.45)",
  cardinalColorNorth,
}: WindCompassDialProps) {
  const n = cardinalColorNorth ?? accentColor;

  return (
    <svg
      width={sizePx}
      height={sizePx}
      viewBox="0 0 56 56"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <circle
        cx={28}
        cy={28}
        r={25}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={1}
      />
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
            fill={label === "N" ? n : cardinalColorDim}
          >
            {label}
          </text>
        );
      })}
      <g transform={`rotate(${windDirectionDeg}, 28, 28)`}>
        <line
          x1={28}
          y1={28}
          x2={28}
          y2={8}
          stroke={accentColor}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <polygon points="28,4 24,11 32,11" fill={accentColor} />
        <line
          x1={28}
          y1={34}
          x2={28}
          y2={28}
          stroke={accentColor}
          strokeWidth={1.5}
          strokeLinecap="round"
          opacity={0.5}
        />
      </g>
      <circle cx={28} cy={28} r={3} fill={accentColor} opacity={0.9} />
    </svg>
  );
}
