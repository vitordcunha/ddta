import { type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Minimize2, X } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/useMediaQuery";

export type PlannerExpandedTabId =
  | "mission"
  | "weather"
  | "calibration"
  | "export";

const TABS: { id: PlannerExpandedTabId; label: string }[] = [
  { id: "mission", label: "Missão" },
  { id: "weather", label: "Clima & Solar" },
  { id: "calibration", label: "Calibração" },
  { id: "export", label: "Exportar" },
];

type FlightPlannerExpandedModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeTab: PlannerExpandedTabId;
  onTabChange: (tab: PlannerExpandedTabId) => void;
  title: string;
  subtitle?: string;
  headerBadge?: ReactNode;
  mission: ReactNode;
  weather: ReactNode;
  calibration: ReactNode;
  exportContent: ReactNode;
};

export function FlightPlannerExpandedModal({
  open,
  onOpenChange,
  activeTab,
  onTabChange,
  title,
  subtitle,
  headerBadge,
  mission,
  weather,
  calibration,
  exportContent,
}: FlightPlannerExpandedModalProps) {
  const narrowPortrait = useMediaQuery("(max-width: 767px)");
  const tabBody =
    activeTab === "mission"
      ? mission
      : activeTab === "weather"
        ? weather
        : activeTab === "calibration"
          ? calibration
          : exportContent;

  /** Portal evita que `overflow` no painel flutuante corte `position: fixed`. */
  const layer = (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="planner-expanded-layer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="planner-expanded-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="pointer-events-none fixed inset-0 z-[200]"
        >
          <motion.div
            initial={narrowPortrait ? { y: "105%" } : { x: "105%" }}
            animate={narrowPortrait ? { y: 0 } : { x: 0 }}
            exit={narrowPortrait ? { y: "105%" } : { x: "105%" }}
            transition={{ type: "spring", damping: 38, stiffness: 280 }}
            className={cn(
              "pointer-events-auto absolute flex max-h-full flex-col overflow-hidden border border-white/[0.12] bg-[#141414]/[0.97] shadow-[0_0_48px_rgba(0,0,0,0.45)] backdrop-blur-md",
              narrowPortrait
                ? "inset-x-0 bottom-0 h-[min(80dvh,920px)] rounded-t-2xl"
                : "bottom-0 top-[var(--topbar-height,3.5rem)] w-[min(90vw,720px)] rounded-l-2xl",
            )}
            style={
              narrowPortrait
                ? undefined
                : {
                    right: "max(0px, var(--right-panel-width, 0px))",
                  }
            }
          >
            <div className="flex shrink-0 flex-col gap-2 border-b border-white/[0.08] px-4 pb-3 pt-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2
                    id="planner-expanded-title"
                    className="text-base font-semibold tracking-tight text-[#fafafa]"
                  >
                    {title}
                  </h2>
                  {subtitle ? (
                    <p className="mt-0.5 truncate text-sm text-[#898989]">
                      {subtitle}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-11 gap-1.5 px-3 text-neutral-300 hover:text-white"
                    onClick={() => onOpenChange(false)}
                  >
                    <Minimize2 className="size-4" aria-hidden />
                    <span className="hidden sm:inline">Compactar</span>
                  </Button>
                  <button
                    type="button"
                    className="touch-target flex min-h-11 min-w-11 items-center justify-center rounded-lg text-neutral-400 hover:bg-white/[0.06] hover:text-white"
                    onClick={() => onOpenChange(false)}
                    aria-label="Fechar planejador expandido"
                  >
                    <X className="size-5" aria-hidden />
                  </button>
                </div>
              </div>
              {headerBadge ? (
                <div className="min-w-0 overflow-x-auto">{headerBadge}</div>
              ) : null}
              <div
                role="tablist"
                aria-label="Secções do planejador"
                className="flex gap-1 overflow-x-auto pb-0.5 [scrollbar-width:thin]"
              >
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    role="tab"
                    type="button"
                    aria-selected={activeTab === t.id}
                    className={cn(
                      "touch-target shrink-0 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      activeTab === t.id
                        ? "bg-primary-500/20 text-primary-200 ring-1 ring-primary-500/35"
                        : "text-neutral-400 hover:bg-white/[0.05] hover:text-neutral-200",
                    )}
                    onClick={() => onTabChange(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div
              role="tabpanel"
              className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 [overscroll-behavior:contain] [scrollbar-gutter:stable]"
            >
              <div className="space-y-3">{tabBody}</div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(layer, document.body);
}
