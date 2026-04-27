import type { MutableRefObject } from "react";
import type { Transition } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  CloudSun,
  Eye,
  EyeOff,
  GripHorizontal,
  Maximize2,
  Minimize2,
  MoveVertical,
  Wind,
  Zap,
  ZapOff,
} from "lucide-react";
import { useFlightStore } from "@/features/flight-planner/stores/useFlightStore";
import { windDegToCompass } from "@/features/flight-planner/utils/weatherHelpers";
import { WindCompassDial } from "@/features/flight-planner/components/WindCompassDial";
import { PlannerWeatherWindModal } from "@/features/flight-planner/components/PlannerWeatherWindModal";
import {
  attachHoldStillLongPressToElement,
  MAP_LONG_PRESS_MARKER_TOUCH_SLOP_PX,
} from "@/features/flight-planner/utils/mapLongPress";
import {
  RadialContextMenu,
  type RadialMenuItem,
} from "@/features/map-engine/components/RadialContextMenu";
import { haptic } from "@/utils/haptics";
import {
  clampWindIndicatorOffsetYPx,
  useWindIndicatorPrefs,
} from "@/features/flight-planner/hooks/useWindIndicatorPrefs";

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

/** Troca chip ↔ card: spring curto, pouco overshoot. */
const MODE_SWAP_SPRING: Transition = {
  type: "spring",
  damping: 32,
  stiffness: 400,
  mass: 0.85,
};

/** Largura / escala do dial no modo compacto. */
const COMPACT_LAYOUT: Transition = {
  type: "spring",
  damping: 28,
  stiffness: 380,
  mass: 0.7,
};

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

function modeSwapTransition(reduced: boolean): Transition {
  if (reduced) return { duration: 0.12, ease: "linear" };
  return MODE_SWAP_SPRING;
}

function compactLayoutTransition(reduced: boolean): Transition {
  if (reduced) return { duration: 0.12, ease: "linear" };
  return COMPACT_LAYOUT;
}

function lineFadeTransition(reduced: boolean): Transition {
  if (reduced) return { duration: 0.1, ease: "linear" };
  return { duration: 0.2, ease: EASE_OUT };
}

function releaseSuppressClickAfterDelay(ref: MutableRefObject<boolean>) {
  window.setTimeout(() => {
    ref.current = false;
  }, 380);
}

const chipBtnMotionClass =
  "pointer-events-auto flex size-11 cursor-pointer select-none items-center justify-center rounded-full outline-none ring-sky-400/50 touch-manipulation";

const mainBtnMotionClass =
  "pointer-events-auto flex cursor-pointer select-none flex-col items-center gap-1 rounded-xl px-2 pb-2 pt-1.5 text-left outline-none ring-sky-400/50 touch-manipulation overflow-hidden";

export function WindIndicatorOverlay() {
  const weather = useFlightStore((s) => s.weather);
  const assessment = useFlightStore((s) => s.assessment);
  const [prefs, patchPrefs] = useWindIndicatorPrefs();
  const [detailOpen, setDetailOpen] = useState(false);
  const [radial, setRadial] = useState<null | {
    anchor: "main" | "chip";
    x: number;
    y: number;
  }>(null);
  /** Durante arrasto: offset em px; fora do arrasto: null (usa prefs.offsetYPx). */
  const [dragOffsetY, setDragOffsetY] = useState<number | null>(null);

  const prefersReducedMotion = useReducedMotion();
  const reduced = Boolean(prefersReducedMotion);
  const swapT = modeSwapTransition(reduced);
  const layoutT = compactLayoutTransition(reduced);
  const lineT = lineFadeTransition(reduced);

  const mainBtnRef = useRef<HTMLButtonElement>(null);
  const chipBtnRef = useRef<HTMLButtonElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const pressCoordRef = useRef({ x: 0, y: 0 });
  const suppressDetailClickRef = useRef(false);

  const dismissRadial = useCallback(() => {
    setRadial(null);
    releaseSuppressClickAfterDelay(suppressDetailClickRef);
  }, []);

  const openRadial = useCallback(
    (anchor: "main" | "chip", pos: { x: number; y: number }) => {
      haptic.heavy();
      suppressDetailClickRef.current = true;
      setRadial({ anchor, x: pos.x, y: pos.y });
    },
    [],
  );

  const onDragHandlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const target = e.currentTarget;
      const pointerId = e.pointerId;
      const startY = e.clientY;
      const origin = prefs.offsetYPx;
      let latest = origin;
      setDragOffsetY(origin);

      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        ev.preventDefault();
        latest = clampWindIndicatorOffsetYPx(origin + ev.clientY - startY);
        setDragOffsetY(latest);
      };

      const end = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        try {
          if (target.hasPointerCapture(pointerId)) {
            target.releasePointerCapture(pointerId);
          }
        } catch {
          /* ignore */
        }
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", end);
        window.removeEventListener("pointercancel", end);
        patchPrefs({ offsetYPx: latest });
        setDragOffsetY(null);
        if (latest !== origin) haptic.light();
      };

      target.setPointerCapture(pointerId);
      window.addEventListener("pointermove", onMove, { passive: false });
      window.addEventListener("pointerup", end);
      window.addEventListener("pointercancel", end);
    },
    [prefs.offsetYPx, patchPrefs],
  );

  useEffect(() => {
    const el = prefs.hidden ? chipBtnRef.current : mainBtnRef.current;
    if (!el || detailOpen || radial !== null) return undefined;

    const ctl = attachHoldStillLongPressToElement(el, {
      slopPx: MAP_LONG_PRESS_MARKER_TOUCH_SLOP_PX,
      onStart: (coords) => {
        pressCoordRef.current = coords;
      },
      onFire: () => {
        const p = pressCoordRef.current;
        openRadial(prefs.hidden ? "chip" : "main", p);
      },
    });

    return () => ctl.detach();
  }, [detailOpen, openRadial, prefs.hidden, radial, weather]);

  /** Tablet/Safari: long press não deve iniciar seleção de texto. */
  useEffect(() => {
    const onSelectStart = (e: Event) => e.preventDefault();
    const nodes = [
      mainBtnRef.current,
      chipBtnRef.current,
      handleRef.current,
    ].filter((n): n is HTMLElement => n != null);
    for (const node of nodes) {
      node.addEventListener("selectstart", onSelectStart);
    }
    return () => {
      for (const node of nodes) {
        node.removeEventListener("selectstart", onSelectStart);
      }
    };
  }, [prefs.hidden, weather]);

  /** Se a janela encolher, mantém o offset dentro dos limites. */
  useEffect(() => {
    const onResize = () => {
      const c = clampWindIndicatorOffsetYPx(prefs.offsetYPx);
      if (c !== prefs.offsetYPx) patchPrefs({ offsetYPx: c });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [prefs.offsetYPx, patchPrefs]);

  const radialItems = useMemo<RadialMenuItem[]>(() => {
    if (radial?.anchor === "chip") {
      const chipItems: RadialMenuItem[] = [
        {
          id: "show",
          icon: Eye,
          label: "Mostrar indicador",
          colorClass: "text-sky-300",
        },
      ];
      if (prefs.offsetYPx !== 0) {
        chipItems.push({
          id: "offset-reset",
          icon: MoveVertical,
          label: "Posição vertical padrão",
          colorClass: "text-violet-300",
        });
      }
      chipItems.push({
        id: "forecast",
        icon: CloudSun,
        label: "Previsão e detalhes",
        colorClass: "text-amber-200",
      });
      return chipItems;
    }

    const items: RadialMenuItem[] = [
      {
        id: "hide",
        icon: EyeOff,
        label: "Esconder indicador",
        colorClass: "text-neutral-300",
      },
    ];

    if (prefs.compact) {
      items.push({
        id: "expand",
        icon: Maximize2,
        label: "Modo expandido",
        colorClass: "text-cyan-300",
      });
    } else {
      items.push({
        id: "compact",
        icon: Minimize2,
        label: "Modo compacto",
        colorClass: "text-cyan-300",
      });
    }

    if (prefs.offsetYPx !== 0) {
      items.push({
        id: "offset-reset",
        icon: MoveVertical,
        label: "Posição vertical padrão",
        colorClass: "text-violet-300",
      });
    }

    items.push({
      id: "forecast",
      icon: CloudSun,
      label: "Previsão e detalhes",
      colorClass: "text-amber-200",
    });

    if (!prefs.compact) {
      items.push({
        id: "gusts-toggle",
        icon: prefs.showGusts ? Zap : ZapOff,
        label: prefs.showGusts ? "Ocultar rajadas" : "Mostrar rajadas",
        colorClass: prefs.showGusts ? "text-yellow-300" : "text-neutral-400",
      });
    }

    return items;
  }, [prefs.compact, prefs.offsetYPx, prefs.showGusts, radial?.anchor]);

  const handleRadialSelect = useCallback(
    (id: string) => {
      if (id === "hide") {
        patchPrefs({ hidden: true });
        haptic.light();
      } else if (id === "show") {
        patchPrefs({ hidden: false });
        haptic.light();
      } else if (id === "compact") {
        patchPrefs({ compact: true });
        haptic.light();
      } else if (id === "expand") {
        patchPrefs({ compact: false });
        haptic.light();
      } else if (id === "gusts-toggle") {
        patchPrefs({ showGusts: !prefs.showGusts });
        haptic.light();
      } else if (id === "offset-reset") {
        patchPrefs({ offsetYPx: 0 });
        haptic.light();
      } else if (id === "forecast") {
        setDetailOpen(true);
        haptic.medium();
      }
      setRadial(null);
      releaseSuppressClickAfterDelay(suppressDetailClickRef);
    },
    [patchPrefs, prefs.showGusts],
  );

  if (!weather) return null;

  const { windDirectionDeg, windSpeedMs, windGustsMs } = weather;
  const color = windColor(assessment?.issues ?? [], assessment?.warnings ?? []);
  const cv = COLOR_VARS[color];
  const cardinal = windDegToCompass(windDirectionDeg);
  const compact = prefs.compact;
  const boxW = compact ? 62 : 74;
  const dialVisualScale = compact ? 44 / 56 : 1;
  const gustDataVisible =
    !compact && prefs.showGusts && windGustsMs && windGustsMs > windSpeedMs + 1;

  const translateY = dragOffsetY ?? prefs.offsetYPx;
  const dragging = dragOffsetY !== null;
  const handleStripClass = prefs.hidden
    ? "w-11"
    : compact
      ? "w-[62px]"
      : "w-[74px]";

  const chipHidden = { opacity: 0, scale: 0.82 };
  const chipVisible = { opacity: 1, scale: 1 };
  const mainHidden = { opacity: 0, scale: 0.92, y: 8 };
  const mainVisible = { opacity: 1, scale: 1, y: 0 };

  const chipStates = reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: chipHidden, animate: chipVisible, exit: chipHidden };

  const mainStates = reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: mainHidden, animate: mainVisible, exit: mainHidden };

  return (
    <>
      <div
        className="pointer-events-none flex flex-col items-end"
        style={{
          transform: `translate3d(0, ${translateY}px, 0)`,
          transition:
            dragging || reduced
              ? "none"
              : "transform 0.22s cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <div
          ref={handleRef}
          role="button"
          tabIndex={0}
          aria-label="Arrastar o indicador na vertical. Setas para cima ou para baixo ajustam a posição; Início repõe a posição padrão."
          title="Arrastar na vertical · setas ↑↓ · Início = padrão"
          className={`pointer-events-auto mb-0.5 flex h-3.5 shrink-0 cursor-ns-resize select-none items-center justify-center rounded-md border border-white/[0.08] bg-black/35 ${handleStripClass} touch-none outline-none ring-sky-400/40 transition-[width] duration-200 ease-out hover:bg-black/45 focus-visible:ring-2 active:bg-black/55`}
          style={{
            WebkitUserSelect: "none",
            userSelect: "none",
            WebkitTouchCallout: "none",
          }}
          onPointerDown={onDragHandlePointerDown}
          onKeyDown={(e) => {
            const step = 14;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              patchPrefs({
                offsetYPx: clampWindIndicatorOffsetYPx(prefs.offsetYPx + step),
              });
              haptic.light();
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              patchPrefs({
                offsetYPx: clampWindIndicatorOffsetYPx(prefs.offsetYPx - step),
              });
              haptic.light();
              return;
            }
            if (e.key === "Home") {
              e.preventDefault();
              patchPrefs({ offsetYPx: 0 });
              haptic.light();
            }
          }}
        >
          <GripHorizontal
            className="size-3.5 opacity-50"
            style={{ color: cv.text }}
            strokeWidth={2}
            aria-hidden
          />
        </div>

        <AnimatePresence mode="popLayout" initial={false}>
          {prefs.hidden ? (
            <motion.button
              key="wind-chip"
              ref={chipBtnRef}
              type="button"
              className={`${chipBtnMotionClass} ${reduced ? "" : "hover:brightness-110"}`}
              style={{
                background: "rgba(10,10,10,0.82)",
                backdropFilter: "blur(6px)",
                border: `1px solid ${cv.border}`,
                boxShadow: `0 0 12px ${cv.glow}`,
                WebkitUserSelect: "none",
                userSelect: "none",
                WebkitTouchCallout: "none",
                transformOrigin: "100% 0%",
              }}
              initial={chipStates.initial}
              animate={chipStates.animate}
              exit={chipStates.exit}
              transition={swapT}
              whileHover={reduced ? undefined : { scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              aria-label="Indicador de vento oculto. Toque para mostrar. Segure para opções."
              title="Mostrar vento (toque) · Opções (segurar)"
              onClick={() => {
                if (suppressDetailClickRef.current) return;
                patchPrefs({ hidden: false });
                haptic.light();
              }}
            >
              <Wind
                className="size-5"
                style={{ color: cv.arrow }}
                aria-hidden
              />
            </motion.button>
          ) : (
            <motion.button
              key="wind-main"
              ref={mainBtnRef}
              type="button"
              className={`${mainBtnMotionClass} ${reduced ? "" : "hover:brightness-110"}`}
              style={{
                background: "rgba(10,10,10,0.75)",
                backdropFilter: "blur(6px)",
                border: `1px solid ${cv.border}`,
                boxShadow: `0 0 14px ${cv.glow}`,
                WebkitUserSelect: "none",
                userSelect: "none",
                WebkitTouchCallout: "none",
                transformOrigin: "100% 0%",
              }}
              initial={mainStates.initial}
              animate={{
                ...mainStates.animate,
                width: boxW,
              }}
              exit={mainStates.exit}
              transition={{
                ...swapT,
                width: layoutT,
                opacity: swapT,
                scale: swapT,
                y: swapT,
              }}
              whileTap={{ scale: 0.98 }}
              aria-haspopup="dialog"
              aria-expanded={detailOpen}
              aria-label={`Clima e vento: ${cardinal}, ${windSpeedMs.toFixed(1)} metros por segundo. Toque para detalhes. Segure para opções.`}
              title="Clima e vento · Segure para menu"
              onClick={() => {
                if (suppressDetailClickRef.current) {
                  suppressDetailClickRef.current = false;
                  return;
                }
                setDetailOpen(true);
              }}
            >
              <motion.div
                className="relative flex shrink-0 items-center justify-center"
                style={{ width: 56, height: 56 }}
                animate={{ scale: dialVisualScale }}
                transition={layoutT}
              >
                <WindCompassDial
                  sizePx={56}
                  windDirectionDeg={windDirectionDeg}
                  accentColor={cv.arrow}
                />
              </motion.div>

              <motion.span
                className="text-center font-mono font-semibold leading-none"
                animate={{
                  fontSize: compact ? 12 : 13,
                }}
                transition={layoutT}
                style={{ color: cv.text }}
                aria-hidden
              >
                {windSpeedMs.toFixed(1)}{" "}
                <motion.span
                  animate={{ fontSize: compact ? 8 : 9 }}
                  transition={layoutT}
                  style={{ fontWeight: 400, color: "rgba(255,255,255,0.55)" }}
                >
                  m/s
                </motion.span>
              </motion.span>

              <AnimatePresence initial={false}>
                {gustDataVisible ? (
                  <motion.span
                    key="gust-row"
                    className="leading-none"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -3 }}
                    transition={lineT}
                    style={{ fontSize: 9, color: "rgba(255,255,255,0.45)" }}
                    aria-hidden
                  >
                    raj. {windGustsMs!.toFixed(1)} m/s
                  </motion.span>
                ) : null}
              </AnimatePresence>

              <AnimatePresence initial={false}>
                {!compact ? (
                  <motion.span
                    key="cardinal"
                    className="leading-none tracking-wider"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 2 }}
                    transition={lineT}
                    style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}
                    aria-hidden
                  >
                    de {cardinal}
                  </motion.span>
                ) : null}
              </AnimatePresence>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {radial ? (
        <RadialContextMenu
          position={{ x: radial.x, y: radial.y }}
          items={radialItems}
          onSelect={handleRadialSelect}
          onDismiss={dismissRadial}
          openedViaHold
        />
      ) : null}

      <PlannerWeatherWindModal
        open={detailOpen}
        onOpenChange={setDetailOpen}
        weather={weather}
        assessment={assessment}
      />
    </>
  );
}
