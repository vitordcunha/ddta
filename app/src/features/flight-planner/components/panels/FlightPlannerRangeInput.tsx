import { memo } from "react";

export const Range = memo(function Range({
  label,
  value,
  min,
  max,
  step,
  onChange,
  unit,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  unit?: string;
  hint?: string;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <div className="grid gap-1 text-xs text-neutral-400">
      <div className="flex items-center justify-between gap-2">
        <span>{label}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="touch-target flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-neutral-700 bg-neutral-950/80 text-lg text-neutral-100 hover:border-neutral-500"
            onClick={() => onChange(clamp(value - step))}
            title="Diminuir"
          >
            −
          </button>
          <input
            type="number"
            inputMode="decimal"
            className="input-base h-11 w-[4.25rem] shrink-0 px-1 text-center font-mono text-sm text-neutral-100"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "" || raw === "-") return;
              const n = Number(raw);
              if (Number.isNaN(n)) return;
              onChange(clamp(n));
            }}
            onBlur={(e) => {
              if (e.target.value === "" || Number.isNaN(Number(e.target.value)))
                onChange(clamp(value));
            }}
          />
          <span className="w-4 shrink-0 text-[11px] text-neutral-500">
            {unit ?? ""}
          </span>
          <button
            type="button"
            className="touch-target flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-neutral-700 bg-neutral-950/80 text-lg text-neutral-100 hover:border-neutral-500"
            onClick={() => onChange(clamp(value + step))}
            title="Aumentar"
          >
            +
          </button>
        </div>
      </div>
      <input
        className="w-full"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
      />
      {hint ? (
        <p className="text-[11px] leading-snug text-neutral-500">{hint}</p>
      ) : null}
    </div>
  );
});
