import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ElementRef,
} from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type RadialMenuItem = {
  id: string;
  icon: LucideIcon;
  label: string;
  /** Classes Tailwind de cor para o ícone e fundo ativo. Ex: "text-red-400" */
  colorClass?: string;
  /** Classes para background do botão. Default: bg-neutral-900/95 */
  bgClass?: string;
  disabled?: boolean;
};

type RadialContextMenuProps = {
  /** Coordenadas da tela (clientX, clientY) do ponto de pressão. */
  position: { x: number; y: number };
  items: RadialMenuItem[];
  onSelect: (id: string) => void;
  onDismiss: () => void;
  /**
   * Quando true, o menu foi aberto por um long-press e o ponteiro ainda está pressionado.
   * O menu rastreia o movimento e dispara na soltura sobre um item.
   */
  openedViaHold?: boolean;
};

const RADIUS = 76;
const BTN = 52;
const TOOLTIP_DELAY_MS = 700;

function getItemPosition(index: number, total: number) {
  // Arco de -150° a -30° (acima do ponto de pressão)
  const startDeg = total === 1 ? -90 : -150;
  const endDeg = total === 1 ? -90 : -30;
  const deg =
    total === 1 ? -90 : startDeg + (index / (total - 1)) * (endDeg - startDeg);
  const rad = (deg * Math.PI) / 180;
  return { x: Math.cos(rad) * RADIUS, y: Math.sin(rad) * RADIUS };
}

function hitTest(
  btn: HTMLButtonElement | null,
  cx: number,
  cy: number,
): boolean {
  if (!btn) return false;
  const r = btn.getBoundingClientRect();
  return cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
}

export function RadialContextMenu({
  position,
  items,
  onSelect,
  onDismiss,
  openedViaHold = false,
}: RadialContextMenuProps) {
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeIdxRef = useRef<number | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [tooltipIndex, setTooltipIndex] = useState<number | null>(null);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTooltipTimer = useCallback(() => {
    if (tooltipTimer.current) {
      clearTimeout(tooltipTimer.current);
      tooltipTimer.current = null;
    }
  }, []);

  // Rastreia posição do ponteiro/toque e detecta qual item está sob o cursor
  const trackPosition = useCallback(
    (cx: number, cy: number) => {
      let found = -1;
      itemRefs.current.forEach((btn, i) => {
        if (hitTest(btn, cx, cy)) found = i;
      });
      const next = found >= 0 ? found : null;
      if (next !== activeIdxRef.current) {
        activeIdxRef.current = next;
        setActiveIndex(next);
        // Tooltip imediato ao deslizar sobre o item (hold-and-slide feedback)
        clearTooltipTimer();
        if (next !== null) {
          setTooltipIndex(next);
        } else {
          setTooltipIndex(null);
        }
      }
    },
    [clearTooltipTimer],
  );

  // Listeners globais para hold-and-release
  useEffect(() => {
    if (!openedViaHold) return;

    const onPointerMove = (e: PointerEvent) => trackPosition(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      if (t) trackPosition(t.clientX, t.clientY);
    };

    const onPointerUp = (e: PointerEvent) => {
      e.preventDefault();
      const idx = activeIdxRef.current;
      if (idx !== null && !items[idx]?.disabled) {
        onSelect(items[idx]!.id);
      } else {
        onDismiss();
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      if (!t) { onDismiss(); return; }
      let found = -1;
      itemRefs.current.forEach((btn, i) => {
        if (hitTest(btn, t.clientX, t.clientY)) found = i;
      });
      if (found >= 0 && !items[found]?.disabled) {
        e.preventDefault();
        onSelect(items[found]!.id);
      } else {
        onDismiss();
      }
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerUp, true);
    window.addEventListener("touchmove", onTouchMove, { passive: true, capture: true } as AddEventListenerOptions);
    window.addEventListener("touchend", onTouchEnd, true);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp, true);
      window.removeEventListener("touchmove", onTouchMove, { capture: true } as EventListenerOptions);
      window.removeEventListener("touchend", onTouchEnd, true);
    };
  }, [openedViaHold, items, onSelect, onDismiss, trackPosition]);

  // Dismiss ao clicar fora (para menus não abertos por hold)
  useEffect(() => {
    if (openedViaHold) return;
    const onPointerDown = (e: PointerEvent) => {
      const outside = !itemRefs.current.some(
        (btn) => btn && btn.contains(e.target as Node),
      );
      if (outside) onDismiss();
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [openedViaHold, onDismiss]);

  // Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  // Clamp para não sair da viewport
  const vpW = typeof window !== "undefined" ? window.innerWidth : 375;
  const vpH = typeof window !== "undefined" ? window.innerHeight : 812;
  const cx = Math.max(RADIUS + BTN / 2, Math.min(vpW - RADIUS - BTN / 2, position.x));
  const cy = Math.max(RADIUS + BTN / 2 + 8, Math.min(vpH - BTN / 2 - 8, position.y));

  return createPortal(
    <>
      {/* Backdrop invisível para capturar taps fora */}
      {!openedViaHold && (
        <div
          className="fixed inset-0 z-[9996]"
          onPointerDown={() => onDismiss()}
        />
      )}

      {/* Ponto de ancoragem visual */}
      <div
        className="pointer-events-none fixed z-[9997]"
        style={{
          left: cx - 5,
          top: cy - 5,
          width: 10,
          height: 10,
        }}
      >
        <div className="absolute inset-0 rounded-full bg-white/40 dd-radial-press-dot" />
        <div className="absolute inset-0 rounded-full bg-white/20 dd-radial-press-ring" />
      </div>

      {/* Itens do menu radial */}
      {items.map((item, i) => {
        const pos = getItemPosition(i, items.length);
        const isActive = activeIndex === i;
        const showTooltip = tooltipIndex === i;
        const Icon = item.icon;

        return (
          <div
            key={item.id}
            className="pointer-events-none fixed z-[9998]"
            style={{
              left: cx + pos.x - BTN / 2,
              top: cy + pos.y - BTN / 2,
              width: BTN,
              height: BTN,
            }}
          >
            {/* Tooltip */}
            {showTooltip && (
              <div
                className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-neutral-950/95 px-2.5 py-1 text-xs font-medium text-neutral-100 shadow-xl backdrop-blur-sm"
                style={{ animation: "dd-tooltip-in 120ms ease-out both" }}
                role="tooltip"
              >
                {item.label}
              </div>
            )}

            <button
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              type="button"
              title={item.label}
              aria-label={item.label}
              disabled={item.disabled}
              className={cn(
                "pointer-events-auto flex size-[52px] items-center justify-center rounded-full border shadow-[0_4px_20px_rgba(0,0,0,0.55)] backdrop-blur-md transition-all duration-100",
                item.bgClass ?? "bg-neutral-900/95",
                item.colorClass ?? "text-neutral-200",
                "border-white/[0.12]",
                isActive && !item.disabled && [
                  "scale-110 border-white/25 shadow-[0_6px_24px_rgba(0,0,0,0.65)]",
                  item.colorClass ? "brightness-125" : "bg-neutral-800/95",
                ],
                item.disabled && "cursor-not-allowed opacity-40",
              )}
              style={{
                animation: `dd-radial-item-in 200ms cubic-bezier(0.22,1,0.36,1) ${i * 35}ms both`,
              }}
              onClick={
                openedViaHold
                  ? undefined
                  : () => {
                      if (!item.disabled) onSelect(item.id);
                    }
              }
              onPointerEnter={() => {
                clearTooltipTimer();
                tooltipTimer.current = setTimeout(
                  () => setTooltipIndex(i),
                  TOOLTIP_DELAY_MS,
                );
              }}
              onPointerLeave={() => {
                clearTooltipTimer();
                setTooltipIndex(null);
              }}
            >
              <Icon className="size-5" aria-hidden />
            </button>
          </div>
        );
      })}
    </>,
    document.body,
  );
}
