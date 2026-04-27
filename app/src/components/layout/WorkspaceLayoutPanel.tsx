import {
  type ReactNode,
  useCallback,
  useLayoutEffect,
  useReducer,
  useRef,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  layoutMobileHeaderClass,
  layoutMobileSheetShellClass,
  layoutPanelCollapseClass,
  layoutPanelFabClass,
  useDeviceTier,
} from "@/lib/deviceUtils";
import { cn } from "@/lib/utils";
import {
  desktopFabSlide,
  desktopPanelSlide,
  mobileCollapsedBarSlide,
  mobileSheetSlide,
  workspacePanelFabTransition,
  workspacePanelTransition,
} from "./workspacePanelMotion";

const DESKTOP = "(min-width: 1024px)";

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
  /** Barra recolhida (mobile) */
  collapsedLabel: string;
  /** Notifica o layout pai (ex.: largura do mapa, pointer-events da camada). */
  onOpenChange?: (open: boolean) => void;
  /** `useTransition` (painel a abrir-fechar) — feedback sutil. */
  transitionPending?: boolean;
};

/**
 * &lt; lg: painel no fundo, bottom sheet, recolher.
 * >= lg: coluna à direita com aba de recolher.
 *
 * Desktop: `children` permanece montado ao recolher (evita remontar o planejador) e o slide
 * usa só transform (sem animar `max-width` em paralelo). Mobile mantém AnimatePresence
 * porque o sheet é in-flow com altura máxima.
 */
export function WorkspaceLayoutPanel({
  children,
  collapsedLabel,
  onOpenChange,
  transitionPending = false,
}: WorkspaceLayoutPanelProps) {
  const deviceTier = useDeviceTier();
  const isDesktop = useMediaQuery(DESKTOP);
  const prefersReducedMotion = useReducedMotion();
  const reduced = Boolean(prefersReducedMotion);
  const panelTransition = workspacePanelTransition(prefersReducedMotion);
  const fabTransition = workspacePanelFabTransition(prefersReducedMotion);

  const [state, dispatch] = useReducer(panelReducer, initialPanelState);
  const { show, layoutHold } = state;
  const layoutOpen = show || layoutHold;

  const stateRef = useRef(state);
  useLayoutEffect(() => {
    stateRef.current = state;
  }, [state]);

  const onDesktopSlideAnimationComplete = useCallback(() => {
    const { show: s, layoutHold: lh } = stateRef.current;
    if (!s && lh) {
      dispatch({ type: "exitDone" });
      onOpenChange?.(false);
    }
  }, [onOpenChange]);

  const onMobileExitComplete = useCallback(() => {
    if (!stateRef.current.layoutHold) return;
    dispatch({ type: "exitDone" });
    onOpenChange?.(false);
  }, [onOpenChange]);

  const onToggle = useCallback(() => {
    if (show) {
      dispatch({ type: "closeStart" });
      return;
    }
    onOpenChange?.(true);
    dispatch({ type: "open" });
  }, [show, onOpenChange]);

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
        <motion.div
          key="workspace-desktop-panel"
          role="region"
          aria-label="Painel do workspace"
          aria-hidden={!show}
          className="panel-animated flex h-full min-h-0 w-full min-w-0 flex-col"
          variants={desktopPanelSlide}
          initial={false}
          animate={show ? "animate" : "exit"}
          custom={reduced}
          transition={panelTransition}
          onAnimationComplete={onDesktopSlideAnimationComplete}
          style={{
            pointerEvents: show && layoutOpen ? "auto" : "none",
          }}
        >
          <div className="flex h-9 shrink-0 items-center justify-end pr-0.5">
            <button
              type="button"
              onClick={onToggle}
              className={cn(
                layoutPanelCollapseClass(deviceTier),
                "hover:text-white",
              )}
              title="Recolher painel"
            >
              <PanelRightClose className="size-5" />
            </button>
          </div>
          <div className="panel-container min-h-0 w-full min-w-0 flex-1 overflow-x-hidden [overscroll-behavior:contain]">
            {children}
          </div>
        </motion.div>

        <AnimatePresence>
          {!show && !layoutHold ? (
            <motion.button
              key="workspace-desktop-reopen"
              type="button"
              onClick={onToggle}
              title="Abrir painel"
              variants={desktopFabSlide}
              initial="initial"
              animate="animate"
              exit="exit"
              custom={reduced}
              transition={fabTransition}
              className={layoutPanelFabClass(deviceTier)}
            >
              <PanelRightOpen className="size-5 shrink-0" />
            </motion.button>
          ) : null}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "w-full min-w-0 [overscroll-behavior:contain]",
        transitionPending &&
          "opacity-90 transition-opacity duration-150 motion-reduce:transition-none",
      )}
      style={{
        paddingLeft: "max(0.5rem, env(safe-area-inset-left, 0px))",
        paddingRight: "max(0.5rem, env(safe-area-inset-right, 0px))",
        paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))",
      }}
    >
      {/*
        Mobile mantém AnimatePresence: sheet in-flow + altura máxima; “sempre montado”
        quebraria o layout da coluna inferior.
      */}
      <AnimatePresence mode="wait" onExitComplete={onMobileExitComplete}>
        {show ? (
          <motion.div
            key="workspace-mobile-sheet"
            role="region"
            aria-label="Painel do workspace"
            className={layoutMobileSheetShellClass(deviceTier)}
            variants={mobileSheetSlide}
            initial="initial"
            animate="animate"
            exit="exit"
            custom={reduced}
            transition={panelTransition}
          >
            <div className="flex shrink-0 items-center border-b border-white/5 px-1 py-0.5">
              <button
                type="button"
                onClick={onToggle}
                className="touch-target flex min-h-11 w-full items-center justify-center gap-1 text-xs text-[#8a8a8a] hover:text-[#b4b4b4]"
                title="Recolher"
              >
                <span
                  className="h-1 w-9 rounded-full bg-[#3a3a3a]"
                  aria-hidden
                />
                <ChevronDown className="size-4" />
              </button>
            </div>
            <div className="panel-container min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain [scrollbar-gutter:stable]">
              {children}
            </div>
          </motion.div>
        ) : !layoutHold ? (
          <motion.button
            key="workspace-mobile-collapsed"
            type="button"
            onClick={onToggle}
            variants={mobileCollapsedBarSlide}
            initial="initial"
            animate="animate"
            exit="exit"
            custom={reduced}
            transition={fabTransition}
            className={layoutMobileHeaderClass(deviceTier)}
          >
            <span className="min-w-0 flex-1 truncate">{collapsedLabel}</span>
            <ChevronUp className="size-5 shrink-0 text-[#3ecf8e]" />
          </motion.button>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
