import { useEffect, useState, type RefObject } from "react";

/**
 * Simula hover durante toque/mouse pressionado quando o dedo está sobre o botão
 * (em touch, `:hover` não acompanha o dedo como no rato).
 */
export function usePointerPressHighlightOverButton(
  active: boolean,
  buttonRef: RefObject<HTMLButtonElement | null>,
): boolean {
  const [pressedOver, setPressedOver] = useState(false);

  useEffect(() => {
    if (!active) {
      setPressedOver(false);
      return undefined;
    }

    let cancelled = false;
    let tries = 0;
    let detach: (() => void) | null = null;

    const tryAttach = () => {
      if (cancelled) return;
      const btn = buttonRef.current;
      if (!btn) {
        tries += 1;
        if (tries < 30) {
          requestAnimationFrame(tryAttach);
        }
        return;
      }
      const onMove = (e: PointerEvent) => {
        if (e.buttons === 0) {
          setPressedOver(false);
          return;
        }
        const el = document.elementFromPoint(e.clientX, e.clientY);
        setPressedOver(Boolean(el && btn.contains(el)));
      };
      const end = () => setPressedOver(false);
      window.addEventListener("pointermove", onMove, { capture: true, passive: true });
      window.addEventListener("pointerup", end, true);
      window.addEventListener("pointercancel", end, true);
      detach = () => {
        window.removeEventListener("pointermove", onMove, { capture: true });
        window.removeEventListener("pointerup", end, true);
        window.removeEventListener("pointercancel", end, true);
      };
    };

    tryAttach();

    return () => {
      cancelled = true;
      detach?.();
      setPressedOver(false);
    };
  }, [active, buttonRef]);

  return pressedOver;
}
