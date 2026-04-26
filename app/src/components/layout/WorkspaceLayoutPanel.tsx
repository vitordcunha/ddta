import { type ReactNode, useCallback, useReducer } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
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
};

/**
 * &lt; lg: painel no fundo, bottom sheet, recolher.
 * >= lg: coluna à direita com aba de recolher.
 */
export function WorkspaceLayoutPanel({
  children,
  collapsedLabel,
  onOpenChange,
}: WorkspaceLayoutPanelProps) {
  const isDesktop = useMediaQuery(DESKTOP);
  const prefersReducedMotion = useReducedMotion();
  const reduced = Boolean(prefersReducedMotion);
  const panelTransition = workspacePanelTransition(prefersReducedMotion);
  const fabTransition = workspacePanelFabTransition(prefersReducedMotion);

  const [state, dispatch] = useReducer(panelReducer, initialPanelState);
  const { show, layoutHold } = state;
  const layoutOpen = show || layoutHold;

  const onToggle = useCallback(() => {
    if (show) {
      dispatch({ type: "closeStart" });
      return;
    }
    onOpenChange?.(true);
    dispatch({ type: "open" });
  }, [show, onOpenChange]);

  const onPanelExitComplete = useCallback(() => {
    if (!layoutHold) return;
    dispatch({ type: "exitDone" });
    onOpenChange?.(false);
  }, [layoutHold, onOpenChange]);

  if (isDesktop) {
    return (
      <div
        className={cn(
          "flex h-full min-h-0 w-full min-w-0 max-w-full flex-1 flex-col [overscroll-behavior:contain]",
          "pr-[max(0.5rem,env(safe-area-inset-right))]",
          "transition-[max-width] duration-200 ease-out motion-reduce:transition-none",
          !layoutOpen &&
            "max-w-0 flex-none overflow-hidden p-0 pr-0 pointer-events-none",
        )}
        onPointerDownCapture={
          layoutOpen ? (e) => e.stopPropagation() : undefined
        }
      >
        <AnimatePresence onExitComplete={onPanelExitComplete}>
          {show ? (
            <motion.div
              key="workspace-desktop-panel"
              role="region"
              aria-label="Painel do workspace"
              className="flex h-full min-h-0 w-full min-w-0 flex-col"
              variants={desktopPanelSlide}
              initial="initial"
              animate="animate"
              exit="exit"
              custom={reduced}
              transition={panelTransition}
            >
              <div className="flex h-9 shrink-0 items-center justify-end pr-0.5">
                <button
                  type="button"
                  onClick={onToggle}
                  className="touch-target touch-manipulation flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-white/10 bg-[#171717]/90 text-[#b4b4b4] shadow-sm backdrop-blur-sm hover:text-white"
                  title="Recolher painel"
                >
                  <PanelRightClose className="size-5" />
                </button>
              </div>
              <div className="min-h-0 w-full min-w-0 flex-1 overflow-x-hidden [overscroll-behavior:contain]">
                {children}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

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
              className="touch-target touch-manipulation pointer-events-auto fixed right-0 top-1/2 z-[100] flex min-h-14 w-12 shrink-0 -translate-y-1/2 flex-col items-center justify-center gap-0.5 rounded-l-xl border border-r-0 border-white/10 bg-[#171717]/95 py-1.5 text-xs font-medium text-[#e8e8e8] shadow-lg backdrop-blur-md"
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
      className="w-full min-w-0 [overscroll-behavior:contain]"
      style={{
        paddingLeft: "max(0.5rem, env(safe-area-inset-left, 0px))",
        paddingRight: "max(0.5rem, env(safe-area-inset-right, 0px))",
        paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))",
      }}
    >
      {/*
        Durante o fecho, `layoutHold` fica true: mostramos `null` para nao montar a barra
        enquanto o sheet ainda faz exit no AnimatePresence (evita saltar o estado).
      */}
      <AnimatePresence mode="wait" onExitComplete={onPanelExitComplete}>
        {show ? (
          <motion.div
            key="workspace-mobile-sheet"
            role="region"
            aria-label="Painel do workspace"
            className="pointer-events-auto flex max-h-[min(52svh,560px)] min-h-0 w-full flex-col overflow-hidden rounded-t-2xl border border-b-0 border-white/10 bg-[#0a0a0a]/[0.25] shadow-[0_-4px_32px_rgba(0,0,0,0.45)] backdrop-blur-sm"
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
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain [scrollbar-gutter:stable]">
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
            className="touch-target touch-manipulation pointer-events-auto flex min-h-12 w-full shrink-0 items-center justify-between gap-2 rounded-t-2xl border border-b-0 border-white/10 bg-[#171717]/95 px-4 text-left text-sm font-medium text-[#fafafa] shadow-[0_-4px_24px_rgba(0,0,0,0.35)] backdrop-blur-md"
          >
            <span className="min-w-0 flex-1 truncate">{collapsedLabel}</span>
            <ChevronUp className="size-5 shrink-0 text-[#3ecf8e]" />
          </motion.button>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
