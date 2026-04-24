interface OpacityControlProps {
  opacity: number
  onChange: (value: number) => void
}

export function OpacityControl({ opacity, onChange }: OpacityControlProps) {
  return (
    <label className="flex items-center gap-2 text-xs text-neutral-400">
      Opacidade
      <input
        type="range"
        min={0}
        max={100}
        value={opacity}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-40"
      />
      <span className="font-mono text-neutral-200">{opacity}%</span>
    </label>
  )
}
