import {
  type ReactNode,
  useCallback,
  useLayoutEffect,
  useReducer,
  useRef,
} from "react";
import {
  AnimatePresence,
  motion,
  useDragControls,
  useReducedMotion,
} from "framer-motion";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { useIsDesktop } from "@/hooks/useBreakpoint";
import {
  layoutPanelFabClass,
  maybeBackdropBlur,
  useDeviceTier,
} from "@/lib/deviceUtils";
import { cn } from "@/lib/utils";
import {
  desktopFabSlide,
  desktopPanelSlide,
  mobileSidePanelSlide,
  workspacePanelFabTransition,
  workspacePanelTransition,
} from "./workspacePanelMotion";

type PanelState = { show: boolean; layoutHold: boolean };

type PanelAction =
  | { type: "closeStart" }
  | { type: "open" }
  | { type: "exitDone" };

function panelReducer(state: PanelState, action: PanelAction): PanelState {
  switch (action.type) {
    case "closeStart":
      return { show: false, layoutHold: true };
    case "open":
      return { show: true, layoutHold: false };
    case "exitDone":
      return { show: false, layoutHold: false };
    default:
      return state;
  }
}

const initialPanelState: PanelState = { show: true, layoutHold: false };

type WorkspaceLayoutPanelProps = {
  children: ReactNode;
  /** Rótulo exibido no botão de reabrir (colapsado). */
  collapsedLabel: string;
  /** Notifica o layout pai (ex.: largura do mapa, pointer-events da camada). */
  onOpenChange?: (open: boolean) => void;
  /** `useTransition` (painel a abrir-fechar) — feedback sutil. */
  transitionPending?: boolean;
};

/**
 * Mobile/tablet: painel lateral direito fixo (altura total) com handle à esquerda.
 * Arraste o handle para a direita para fechar; toque no handle para fechar.
 * Colapsado: FAB fixo no canto direito. O conteúdo permanece montado (slide + visibility)
 * para não remontar o planejador a cada abertura — menos JS e sem re-hidratar o store.
 *
 * Desktop (min-width 1280px): coluna à direita com aba de toggle.
 */
export function WorkspaceLayoutPanel({
  children,
  collapsedLabel,
  onOpenChange,
  transitionPending = false,
}: WorkspaceLayoutPanelProps) {
  const deviceTier = useDeviceTier();
  const isDesktop = useIsDesktop();
  const prefersReducedMotion = useReducedMotion();
  const reduced = Boolean(prefersReducedMotion);
  const panelTransition = workspacePanelTransition(prefersReducedMotion);
  const fabTransition = workspacePanelFabTransition(prefersReducedMotion);
  const dragControls = useDragControls();

  const [state, dispatch] = useReducer(panelReducer, initialPanelState);
  const { show, layoutHold } = state;
  const layoutOpen = show || layoutHold;

  const stateRef = useRef(state);
  useLayoutEffect(() => {
    stateRef.current = state;
  }, [state]);

  /** Fim da animação de fechamento: libera layoutHold e sincroniza `rightPanelOpen` no pai. */
  const onPanelSlideAnimationComplete = useCallback(() => {
    const { show: s, layoutHold: lh } = stateRef.current;
    if (!s && lh) {
      dispatch({ type: "exitDone" });
      onOpenChange?.(false);
    }
  }, [onOpenChange]);

  const onToggle = useCallback(() => {
    if (show) {
      dispatch({ type: "closeStart" });
      return;
    }
    onOpenChange?.(true);
    dispatch({ type: "open" });
  }, [show, onOpenChange]);

  const handleMobileDragEnd = useCallback(
    (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
      if (info.offset.x > 80 || info.velocity.x > 400) {
        dispatch({ type: "closeStart" });
      }
    },
    [],
  );

  // ── Desktop ───────────────────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <div
        className={cn(
          "flex h-full min-h-0 w-full min-w-0 max-w-full flex-1 flex-col [overscroll-behavior:contain]",
          "pr-[max(0.5rem,env(safe-area-inset-right))]",
          !layoutOpen &&
            "max-w-0 flex-none overflow-hidden p-0 pr-0 pointer-events-none",
          transitionPending &&
            "opacity-90 transition-opacity duration-150 motion-reduce:transition-none",
        )}
        onPointerDownCapture={
          layoutOpen ? (e) => e.stopPropagation() : undefined
        }
      >
        <button
          type="button"
          onClick={onToggle}
          className={layoutPanelFabClass(deviceTier)}
          title={show ? "Recolher painel" : "Abrir painel"}
        >
          {show ? (
            <PanelRightClose className="size-5 shrink-0" />
          ) : (
            <PanelRightOpen className="size-5 shrink-0" />
          )}
        </button>
        <motion.div
          key="workspace-desktop-panel"
          role="region"
          aria-label="Painel do workspace"
          aria-hidden={!show}
          className="panel-animated flex h-full min-h-0 w-full min-w-0 flex-1 flex-col"
          variants={desktopPanelSlide}
          initial={false}
          animate={show ? "animate" : "exit"}
          custom={reduced}
          transition={panelTransition}
          onAnimationComplete={onPanelSlideAnimationComplete}
          style={{ pointerEvents: show && layoutOpen ? "auto" : "none" }}
        >
          <div className="panel-container min-h-0 w-full min-w-0 flex-1 overflow-x-hidden [overscroll-behavior:contain]">
            {children}
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Mobile / tablet ───────────────────────────────────────────────────────
  return (
    <>
      {/* FAB colapsado — fixo no canto direito, visível só quando painel fechado */}
      <AnimatePresence>
        {!show && !layoutHold && (
          <motion.button
            key="workspace-mobile-fab"
            type="button"
            onClick={onToggle}
            className={layoutPanelFabClass(deviceTier)}
            title={collapsedLabel}
            variants={desktopFabSlide}
            initial="initial"
            animate="animate"
            exit="exit"
            custom={reduced}
            transition={fabTransition}
          >
            <PanelRightOpen className="size-5 shrink-0" />
          </motion.button>
        )}
      </AnimatePresence>

      <motion.div
        key="workspace-mobile-side-panel"
        role="region"
        aria-label="Painel do workspace"
        aria-hidden={!show}
        className={cn(
          "panel-animated fixed z-50 flex flex-row overflow-hidden",
          "border-l border-white/10 shadow-[-6px_0_32px_rgba(0,0,0,0.5)]",
          deviceTier === "high"
            ? `bg-[rgba(18,18,20,0.92)] ${maybeBackdropBlur(deviceTier, "sm")}`
            : "bg-[rgba(26,26,26,0.97)]",
        )}
        style={{
          top: "max(3.5rem, calc(3.5rem + env(safe-area-inset-top, 0px)))",
          bottom: "env(safe-area-inset-bottom, 0px)",
          right: "env(safe-area-inset-right, 0px)",
          width: "min(88vw, 360px)",
          pointerEvents: show || layoutHold ? "auto" : "none",
          visibility: show || layoutHold ? "visible" : "hidden",
        }}
        drag={show ? "x" : false}
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0, right: 0.3 }}
        onDragEnd={handleMobileDragEnd}
        variants={mobileSidePanelSlide}
        initial={false}
        animate={show ? "animate" : "exit"}
        custom={reduced}
        transition={panelTransition}
        onAnimationComplete={onPanelSlideAnimationComplete}
      >
        <button
          type="button"
          title="Fechar painel"
          className="group flex w-6 shrink-0 touch-none cursor-grab items-center justify-center self-stretch border-r border-white/[0.06] active:cursor-grabbing"
          onPointerDown={(e) => dragControls.start(e)}
          onClick={onToggle}
        >
          <span
            className="h-12 w-1 rounded-full bg-white/25 transition-all duration-200 motion-safe:animate-[dd-handle-breathe_3s_ease-in-out_infinite] group-active:bg-white/50"
            aria-hidden
          />
        </button>

        <div
          className={cn(
            "panel-container min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain [scrollbar-gutter:stable]",
            transitionPending &&
              "opacity-90 transition-opacity duration-150 motion-reduce:transition-none",
          )}
        >
          {children}
        </div>
      </motion.div>
    </>
  );
}
