import { cn } from '@/lib/utils'

export interface MapControls3DProps {
  onBearingReset: () => void
  onPitchChange: (delta: number) => void
  onZoom: (delta: number) => void
  /** Só visível em modo 3D (Mapbox/Google) e em landscape. */
  visible: boolean
}

function ControlButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-xl',
        'border border-white/10 bg-[#1a1a1a]/80 text-[#fafafa]',
        'shadow transition hover:bg-white/10 active:scale-95 backdrop-blur-sm',
      )}
    >
      {children}
    </button>
  )
}

/**
 * Módulo 1: Cluster de controles 3D — reset do norte, pitch e zoom.
 * Posicionado acima do WindIndicatorOverlay no canto inferior direito do mapa.
 * Visível apenas em modo 3D (Mapbox ou Google Maps) e orientação landscape.
 */
export function MapControls3D({ onBearingReset, onPitchChange, onZoom, visible }: MapControls3DProps) {
  if (!visible) return null

  return (
    <div
      className="pointer-events-auto flex flex-col gap-1"
      role="group"
      aria-label="Controles 3D do mapa"
    >
      {/* Reset norte */}
      <ControlButton onClick={onBearingReset} title="Alinhar ao norte">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M12 2L4 22l8-4 8 4L12 2z" />
        </svg>
      </ControlButton>

      {/* Aumentar pitch */}
      <ControlButton onClick={() => onPitchChange(15)} title="Aumentar inclinação (+15°)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path d="M5 15l7-7 7 7" />
        </svg>
      </ControlButton>

      {/* Diminuir pitch */}
      <ControlButton onClick={() => onPitchChange(-15)} title="Diminuir inclinação (-15°)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path d="M19 9l-7 7-7-7" />
        </svg>
      </ControlButton>

      {/* Zoom in */}
      <ControlButton onClick={() => onZoom(1)} title="Zoom in">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path d="M12 5v14M5 12h14" />
        </svg>
      </ControlButton>

      {/* Zoom out */}
      <ControlButton onClick={() => onZoom(-1)} title="Zoom out">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path d="M5 12h14" />
        </svg>
      </ControlButton>
    </div>
  )
}
