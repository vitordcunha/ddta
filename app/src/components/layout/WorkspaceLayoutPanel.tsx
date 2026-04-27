import {
  type MutableRefObject,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  AnimatePresence,
  motion,
  useDragControls,
  useReducedMotion,
} from "framer-motion";
import {
  Columns2,
  GripVertical,
  PanelRightClose,
  PanelRightOpen,
  PictureInPicture2,
} from "lucide-react";
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
import {
  SPLIT_PANEL_COLLAPSED_PX,
  SPLIT_PANEL_COLLAPSE_RELEASE_PX,
  SPLIT_PANEL_DEFAULT_PX,
  SPLIT_PANEL_MAX_VIEWPORT_FRACTION,
  SPLIT_PANEL_MIN_CONTENT_PX,
  SPLIT_SEP_HIT_PX,
  SPLIT_SEP_TAP_MAX_CLIENT_DX,
  SPLIT_WIDTH_STORAGE_KEY,
} from "./workspaceSplitConstants";

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

type SplitMetrics = { widthPx: number; collapsed: boolean };

type WorkspaceLayoutPanelProps = {
  children: ReactNode;
  /** Rótulo exibido no botão de reabrir (colapsado). */
  collapsedLabel: string;
  /** Notifica o layout pai (ex.: largura do mapa, pointer-events da camada). */
  onOpenChange?: (open: boolean) => void;
  /** `useTransition` (painel a abrir-fechar) — feedback sutil. */
  transitionPending?: boolean;
  /**
   * Tablet landscape: coluna fixa à direita com separador (split view).
   * Quando falso, mantém overlay lateral / desktop.
   */
  splitLayout?: boolean;
  /** Volta ao painel flutuante sobre o mapa (sessão). */
  onSplitDetach?: () => void;
  /** Restaura o layout dividido (mapa + coluna) após desanexar; só no overlay tablet landscape. */
  onSplitReattach?: () => void;
  /** Largura efetiva da coluna direita para `--right-panel-width` e resize do mapa. */
  onSplitMetrics?: (m: SplitMetrics) => void;
  /** Chamado após soltar o separador (mapa pode invalidar tamanho). */
  onSplitResizeCommit?: () => void;
  /** Ref global: true enquanto o separador split está arrastando (ex.: pausar `invalidateSize` no Leaflet). */
  splitDragActiveRef?: MutableRefObject<boolean>;
  /** Início do arraste do separador (pai pode omitir `--right-panel-width` do style React). */
  onSplitDragStart?: () => void;
  /** Fim do arraste — restaurar controle React das variáveis CSS. */
  onSplitDragEnd?: () => void;
  /** Largura ao vivo durante o arraste (1× por frame via rAF); não dispare `setState` aqui. */
  onSplitPreviewWidth?: (widthPx: number) => void;
};

function readMaxSplitWidth(): number {
  if (typeof window === "undefined") return 520;
  return Math.max(
    SPLIT_PANEL_MIN_CONTENT_PX + 40,
    Math.round(window.innerWidth * SPLIT_PANEL_MAX_VIEWPORT_FRACTION),
  );
}

function readStoredSplitWidth(): number | null {
  try {
    const raw = localStorage.getItem(SPLIT_WIDTH_STORAGE_KEY);
    if (!raw) return null;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) return null;
    return n;
  } catch {
    return null;
  }
}

/**
 * Mobile/tablet overlay: painel lateral direito com handle.
 * Desktop: coluna com aba.
 * Tablet landscape + `splitLayout`: coluna redimensionável estilo split view (Phase 4-A).
 */
export function WorkspaceLayoutPanel({
  children,
  collapsedLabel,
  onOpenChange,
  transitionPending = false,
  splitLayout = false,
  onSplitDetach,
  onSplitReattach,
  onSplitMetrics,
  onSplitResizeCommit,
  splitDragActiveRef,
  onSplitDragStart,
  onSplitDragEnd,
  onSplitPreviewWidth,
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

  const [splitCollapsed, setSplitCollapsed] = useState(false);
  const [splitWidthPx, setSplitWidthPx] = useState(SPLIT_PANEL_DEFAULT_PX);
  /** Enquanto true, a largura do painel split é aplicada só no DOM (evita re-render a cada pointermove). */
  const [splitResizeSession, setSplitResizeSession] = useState(false);
  const splitPanelShellRef = useRef<HTMLDivElement>(null);
  const previewRafRef = useRef<number | null>(null);
  const pendingPreviewWRef = useRef<number | null>(null);
  const onSplitPreviewWidthRef = useRef(onSplitPreviewWidth);
  onSplitPreviewWidthRef.current = onSplitPreviewWidth;

  const splitDragRef = useRef<{
    pointerId: number;
    startX: number;
    startW: number;
    previewW: number;
    maxW: number;
  } | null>(null);

  const stateRef = useRef(state);
  useLayoutEffect(() => {
    stateRef.current = state;
  }, [state]);

  const splitEnteredRef = useRef(false);
  useEffect(() => {
    if (!splitLayout) {
      splitEnteredRef.current = false;
      return;
    }
    if (splitEnteredRef.current) return;
    splitEnteredRef.current = true;
    const maxW = readMaxSplitWidth();
    const stored = readStoredSplitWidth();
    const base =
      stored != null && stored >= SPLIT_PANEL_COLLAPSE_RELEASE_PX + 24
        ? Math.min(stored, maxW)
        : SPLIT_PANEL_DEFAULT_PX;
    setSplitWidthPx(Math.min(Math.max(base, SPLIT_PANEL_MIN_CONTENT_PX), maxW));
    setSplitCollapsed(false);
  }, [splitLayout]);

  const reportMetrics = useCallback(() => {
    const w = splitCollapsed ? SPLIT_PANEL_COLLAPSED_PX : splitWidthPx;
    onSplitMetrics?.({ widthPx: w, collapsed: splitCollapsed });
  }, [onSplitMetrics, splitCollapsed, splitWidthPx]);

  useLayoutEffect(() => {
    if (!splitLayout) return;
    reportMetrics();
  }, [splitLayout, reportMetrics]);

  const persistWidth = useCallback((w: number) => {
    try {
      localStorage.setItem(SPLIT_WIDTH_STORAGE_KEY, String(Math.round(w)));
    } catch {
      /* ignore */
    }
  }, []);

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

  const clampOpenWidth = useCallback((w: number) => {
    const maxW = readMaxSplitWidth();
    return Math.min(Math.max(w, SPLIT_PANEL_MIN_CONTENT_PX), maxW);
  }, []);

  const scheduleSplitPreview = useCallback((widthPx: number) => {
    pendingPreviewWRef.current = widthPx;
    if (previewRafRef.current != null) return;
    previewRafRef.current = requestAnimationFrame(() => {
      previewRafRef.current = null;
      const w = pendingPreviewWRef.current;
      if (w != null) onSplitPreviewWidthRef.current?.(w);
    });
  }, []);

  const expandSplitFromStrip = useCallback(() => {
    const maxW = readMaxSplitWidth();
    const stored = readStoredSplitWidth();
    const w =
      stored != null && stored >= SPLIT_PANEL_COLLAPSE_RELEASE_PX + 24
        ? Math.min(stored, maxW)
        : SPLIT_PANEL_DEFAULT_PX;
    const next = clampOpenWidth(w);
    setSplitCollapsed(false);
    setSplitWidthPx(next);
    persistWidth(next);
    onSplitResizeCommit?.();
  }, [clampOpenWidth, onSplitResizeCommit, persistWidth]);

  const collapseSplitPanel = useCallback(() => {
    if (splitCollapsed) return;
    setSplitCollapsed(true);
    onSplitMetrics?.({
      widthPx: SPLIT_PANEL_COLLAPSED_PX,
      collapsed: true,
    });
    onSplitPreviewWidth?.(SPLIT_PANEL_COLLAPSED_PX);
    onSplitResizeCommit?.();
  }, [splitCollapsed, onSplitMetrics, onSplitPreviewWidth, onSplitResizeCommit]);

  const onSeparatorPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!splitLayout) return;
      e.preventDefault();
      const startW = splitCollapsed ? SPLIT_PANEL_COLLAPSED_PX : splitWidthPx;
      const maxW = readMaxSplitWidth();
      splitDragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startW,
        previewW: startW,
        maxW,
      };
      if (splitDragActiveRef) splitDragActiveRef.current = true;
      onSplitDragStart?.();
      const shell = splitPanelShellRef.current;
      if (shell) shell.style.width = `${startW}px`;
      onSplitPreviewWidthRef.current?.(startW);
      setSplitResizeSession(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [
      splitCollapsed,
      splitLayout,
      splitWidthPx,
      splitDragActiveRef,
      onSplitDragStart,
    ],
  );

  const onSeparatorPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = splitDragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const delta = e.clientX - d.startX;
      const next = d.startW - delta;
      const clamped = Math.min(
        Math.max(next, SPLIT_PANEL_COLLAPSED_PX),
        d.maxW,
      );
      d.previewW = clamped;
      const shell = splitPanelShellRef.current;
      if (shell) shell.style.width = `${clamped}px`;
      scheduleSplitPreview(clamped);
      if (clamped > SPLIT_PANEL_COLLAPSE_RELEASE_PX + 6) {
        setSplitCollapsed(false);
      }
    },
    [scheduleSplitPreview],
  );

  const onSeparatorPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const d = splitDragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      if (previewRafRef.current != null) {
        cancelAnimationFrame(previewRafRef.current);
        previewRafRef.current = null;
      }
      const pendingW = pendingPreviewWRef.current;
      if (pendingW != null) onSplitPreviewWidthRef.current?.(pendingW);
      pendingPreviewWRef.current = null;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      const preview = d.previewW;
      splitDragRef.current = null;

      const tapOpensFromCollapsedStrip =
        d.startW === SPLIT_PANEL_COLLAPSED_PX &&
        preview < SPLIT_PANEL_COLLAPSE_RELEASE_PX &&
        Math.abs(e.clientX - d.startX) <= SPLIT_SEP_TAP_MAX_CLIENT_DX;

      if (tapOpensFromCollapsedStrip) {
        setSplitResizeSession(false);
        if (splitDragActiveRef) splitDragActiveRef.current = false;
        onSplitDragEnd?.();
        expandSplitFromStrip();
        return;
      }

      const nextCollapsed = preview < SPLIT_PANEL_COLLAPSE_RELEASE_PX;
      const nextOpenW = nextCollapsed ? splitWidthPx : clampOpenWidth(preview);
      const metricsW = nextCollapsed ? SPLIT_PANEL_COLLAPSED_PX : nextOpenW;

      onSplitMetrics?.({ widthPx: metricsW, collapsed: nextCollapsed });

      if (nextCollapsed) {
        setSplitCollapsed(true);
      } else {
        setSplitCollapsed(false);
        setSplitWidthPx(nextOpenW);
        persistWidth(nextOpenW);
      }
      setSplitResizeSession(false);
      if (splitDragActiveRef) splitDragActiveRef.current = false;
      onSplitDragEnd?.();
      onSplitResizeCommit?.();
    },
    [
      clampOpenWidth,
      onSplitDragEnd,
      onSplitMetrics,
      onSplitResizeCommit,
      persistWidth,
      splitDragActiveRef,
      splitWidthPx,
      expandSplitFromStrip,
    ],
  );

  // ── Split (tablet landscape) ─────────────────────────────────────────────
  if (splitLayout && !isDesktop) {
    const effectiveWidth = splitCollapsed
      ? SPLIT_PANEL_COLLAPSED_PX
      : splitWidthPx;

    return (
      <div
        key="workspace-split-panel"
        ref={splitPanelShellRef}
        role="region"
        aria-label="Painel do workspace"
        className={cn(
          "relative z-50 flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-l border-white/10 shadow-[-8px_0_40px_rgba(0,0,0,0.35)]",
          "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-4 motion-safe:duration-300",
          deviceTier === "high"
            ? `bg-[rgba(18,18,20,0.94)] ${maybeBackdropBlur(deviceTier, "sm")}`
            : "bg-[rgba(26,26,26,0.98)]",
        )}
        style={splitResizeSession ? undefined : { width: effectiveWidth }}
      >
        {splitCollapsed ? (
          <button
            type="button"
            className="flex h-full min-h-0 w-full flex-1 flex-col items-center justify-center gap-1 px-0.5 touch-manipulation"
            title="Arraste para a direita ou toque para abrir o painel"
            aria-label="Abrir painel do workspace"
            onClick={expandSplitFromStrip}
          >
            <GripVertical
              className="size-4 shrink-0 text-white/35"
              aria-hidden
            />
          </button>
        ) : (
          <>
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.07] px-2 py-1.5 pr-1">
              <span className="min-w-0 truncate pl-1 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                Painel
              </span>
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  title="Recolher painel — faixa estreita à direita"
                  aria-label="Recolher painel"
                  className="touch-target flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-white/[0.08] hover:text-white"
                  onClick={collapseSplitPanel}
                >
                  <PanelRightClose className="size-4" aria-hidden />
                </button>
                {onSplitDetach ? (
                  <button
                    type="button"
                    title="Janela flutuante — painel sobre o mapa"
                    aria-label="Desanexar painel para modo flutuante"
                    className="touch-target flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-white/[0.08] hover:text-white"
                    onClick={() => onSplitDetach()}
                  >
                    <PictureInPicture2 className="size-4" aria-hidden />
                  </button>
                ) : null}
              </div>
            </div>
            <div
              className={cn(
                "panel-container min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain [scrollbar-gutter:stable]",
                transitionPending &&
                  "opacity-90 transition-opacity duration-150 motion-reduce:transition-none",
              )}
            >
              <div
                className="min-w-0 pr-0"
                style={{
                  minWidth: SPLIT_PANEL_MIN_CONTENT_PX,
                }}
              >
                {children}
              </div>
            </div>
          </>
        )}

        <div
          role="separator"
          aria-orientation="vertical"
          aria-valuenow={Math.round(effectiveWidth)}
          aria-label={
            splitCollapsed
              ? "Abrir ou redimensionar painel"
              : "Redimensionar painel"
          }
          title={
            splitCollapsed
              ? "Toque para abrir ou arraste para redimensionar"
              : "Arrastar para redimensionar o painel"
          }
          className={cn(
            "group absolute left-2 top-1/2 z-[60] flex w-[var(--sep)] -translate-x-1/2 -translate-y-1/2 touch-none cursor-col-resize flex-col items-center justify-center",
            "rounded-full border-x border-white/[0.1] bg-white/[0.02]",
            "transition-[background-color,border-color] duration-200 ease-out",
            "hover:border-white/20 hover:bg-white/[0.06]",
            "active:border-white/25 active:bg-white/[0.1]",
          )}
          style={
            {
              "--sep": `${SPLIT_SEP_HIT_PX}px`,
              height: "100px",
            } as React.CSSProperties
          }
          onPointerDown={onSeparatorPointerDown}
          onPointerMove={onSeparatorPointerMove}
          onPointerUp={onSeparatorPointerUp}
          onPointerCancel={onSeparatorPointerUp}
        >
          <GripVertical
            className={cn(
              "pointer-events-none shrink-0 text-white/28 transition-[color,transform,opacity] duration-200 ease-out",
              "group-hover:text-white/65 group-hover:scale-105",
              "group-active:text-white/90 group-active:scale-[0.98]",
              splitCollapsed ? "size-4" : "size-5",
            )}
            strokeWidth={2}
            aria-hidden
          />
        </div>
      </div>
    );
  }

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

  // ── Mobile / tablet overlay ───────────────────────────────────────────────
  return (
    <>
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

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {onSplitReattach ? (
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.07] px-2 py-1.5 pr-1">
              <span className="min-w-0 truncate pl-1 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                Painel
              </span>
              <button
                type="button"
                title="Dividir tela — mapa ao lado do painel"
                aria-label="Voltar ao layout dividido"
                className="touch-target flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-white/[0.08] hover:text-white"
                onClick={() => onSplitReattach()}
              >
                <Columns2 className="size-4" aria-hidden />
              </button>
            </div>
          ) : null}
          <div
            className={cn(
              "panel-container min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain [scrollbar-gutter:stable]",
              transitionPending &&
                "opacity-90 transition-opacity duration-150 motion-reduce:transition-none",
            )}
          >
            {children}
          </div>
        </div>
      </motion.div>
    </>
  );
}
