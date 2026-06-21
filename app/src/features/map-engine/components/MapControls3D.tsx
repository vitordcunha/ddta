import { useBreakpoint } from "@/hooks/useBreakpoint";
import { touchTargetClass } from "@/lib/deviceUtils";
import { cn } from "@/lib/utils";

export interface MapControls3DProps {
  onBearingReset: () => void;
  onPitchChange: (delta: number) => void;
  onZoom: (delta: number) => void;
  /** Só visível em modo 3D (Mapbox/Google) e em landscape. */
  visible: boolean;
}

function ControlButton({
  onClick,
  title,
  children,
  className,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "flex items-center justify-center rounded-xl",
        "border border-white/10 bg-[#1a1a1a]/80 text-[#fafafa]",
        "shadow transition hover:bg-white/10 active:scale-95 backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </button>
  );
}

/**
 * Cluster 3D (norte, pitch, zoom) no canto inferior direito; o vento fica no topo
 * (WorkspacePage). Visível em 3D + landscape; controles nativos são deslocados no provider.
 */
export function MapControls3D({
  onBearingReset,
  onPitchChange,
  onZoom,
  visible,
}: MapControls3DProps) {
  if (!visible) return null;

  const bp = useBreakpoint();
  const btnSize = cn(
    touchTargetClass(bp),
    bp === "tablet" ? "h-12 w-12" : "h-9 w-9",
  );

  return (
    <div
      className="pointer-events-auto flex flex-col gap-1"
      role="group"
      aria-label="Controles 3D do mapa"
    >
      {/* Reset norte */}
      <ControlButton
        className={btnSize}
        onClick={onBearingReset}
        title="Alinhar ao norte"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path d="M12 2L4 22l8-4 8 4L12 2z" />
        </svg>
      </ControlButton>

      {/* Aumentar pitch */}
      <ControlButton
        className={btnSize}
        onClick={() => onPitchChange(15)}
        title="Aumentar inclinação (+15°)"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden
        >
          <path d="M5 15l7-7 7 7" />
        </svg>
      </ControlButton>

      {/* Diminuir pitch */}
      <ControlButton
        className={btnSize}
        onClick={() => onPitchChange(-15)}
        title="Diminuir inclinação (-15°)"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden
        >
          <path d="M19 9l-7 7-7-7" />
        </svg>
      </ControlButton>

      {/* Zoom in */}
      <ControlButton
        className={btnSize}
        onClick={() => onZoom(1)}
        title="Zoom in"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </ControlButton>

      {/* Zoom out */}
      <ControlButton
        className={btnSize}
        onClick={() => onZoom(-1)}
        title="Zoom out"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden
        >
          <path d="M5 12h14" />
        </svg>
      </ControlButton>
    </div>
  );
}
