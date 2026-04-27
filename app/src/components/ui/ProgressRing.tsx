type ProgressRingProps = {
  /** 0–100. If undefined, renders an indeterminate spinning arc. */
  progress?: number
  size?: number
  strokeWidth?: number
  color?: string
  /** Short text rendered in the center (only useful at larger sizes). */
  label?: string
}

export function ProgressRing({
  progress,
  size = 40,
  strokeWidth = 3,
  color = "#3ecf8e",
  label,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const indeterminate = progress === undefined || progress === null

  const strokeDashoffset = indeterminate
    ? circumference * 0.75
    : circumference - (Math.max(0, Math.min(100, progress)) / 100) * circumference

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={indeterminate ? "animate-spin" : undefined}
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={strokeWidth}
      />
      {/* Fill */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        className="progress-ring__circle"
        style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%" }}
      />
      {label && (
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="currentColor"
          fontSize={Math.round(size * 0.25)}
          fontFamily="system-ui, sans-serif"
          fontWeight={600}
        >
          {label}
        </text>
      )}
    </svg>
  )
}
