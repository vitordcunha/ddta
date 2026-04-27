import { useMap } from 'react-leaflet'
import { createPortal } from 'react-dom'

export interface CrosshairOverlayProps {
  visible: boolean
  onAddVertex: () => void
}

/**
 * Módulo 3: Overlay de crosshair centralizado no mapa para adição de vértices
 * sem necessidade de tap preciso. Ativo quando `crosshairDrawMode` está habilitado
 * nas preferências do usuário e o planner está em modo desenho.
 */
export function CrosshairOverlay({ visible, onAddVertex }: CrosshairOverlayProps) {
  const map = useMap()

  if (!visible) return null

  const container = map.getContainer()

  return createPortal(
    <div
      className="pointer-events-none absolute inset-0 z-[400] flex items-center justify-center"
      aria-hidden="true"
    >
      {/* Linhas do crosshair */}
      <svg
        className="absolute inset-0 h-full w-full overflow-visible"
        style={{ pointerEvents: 'none' }}
        aria-hidden
      >
        <line
          x1="50%"
          y1="0"
          x2="50%"
          y2="calc(50% - 16px)"
          stroke="rgba(255,255,255,0.7)"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
        <line
          x1="50%"
          y1="calc(50% + 16px)"
          x2="50%"
          y2="100%"
          stroke="rgba(255,255,255,0.7)"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
        <line
          x1="0"
          y1="50%"
          x2="calc(50% - 16px)"
          y2="50%"
          stroke="rgba(255,255,255,0.7)"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
        <line
          x1="calc(50% + 16px)"
          y1="50%"
          x2="100%"
          y2="50%"
          stroke="rgba(255,255,255,0.7)"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
        {/* Ponto central */}
        <circle cx="50%" cy="50%" r="4" fill="#60A5FA" stroke="white" strokeWidth="1.5" />
      </svg>

      {/* Botão confirmar vértice — único elemento interativo */}
      <button
        type="button"
        onClick={onAddVertex}
        className="pointer-events-auto absolute flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#60A5FA] bg-[#1e1e2e]/80 text-white shadow-lg transition hover:scale-110 hover:bg-[#1e1e2e] active:scale-95"
        style={{ top: 'calc(50% + 28px)', left: 'calc(50% - 20px)' }}
        title="Confirmar vértice no centro do mapa"
        aria-label="Confirmar vértice"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>,
    container,
  )
}
