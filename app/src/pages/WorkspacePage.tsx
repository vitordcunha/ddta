import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useSearchParams } from "react-router-dom";
import { FloatingPanel } from "@/components/ui/FloatingPanel";
import { WorkspaceMapView } from "@/components/map/WorkspaceMapView";
import { WeatherLayerMapControls } from "@/components/map/WeatherLayerMapControls";
import { useWorkspaceMapWeather } from "@/components/map/useWorkspaceMapWeather";
import { useWeatherMapLayerZoomClamp } from "@/components/map/useWeatherMapLayerZoomClamp";
import { WorkspaceLayoutPanel } from "@/components/layout/WorkspaceLayoutPanel";
import { WorkspaceTopBar } from "@/components/layout/WorkspaceTopBar";
import { SettingsForm } from "@/components/workspace/SettingsForm";
import { FlightPlannerCalculationBridge } from "@/features/flight-planner/components/FlightPlannerCalculationBridge";
import { WaypointEditorPanel } from "@/features/flight-planner/components/WaypointEditorPanel";
import {
  FlightPlannerConfigPanel,
  type FlightPlannerShellProps,
} from "@/features/flight-planner/components/FlightPlannerConfigPanel";
import type { PlannerExpandedTabId } from "@/features/flight-planner/components/FlightPlannerExpandedModal";
import {
  readPlannerShellPrefs,
  writePlannerShellPrefs,
} from "@/features/flight-planner/utils/plannerUiPersistence";
import { WorkspaceMapLeftRail } from "@/components/map/WorkspaceMapLeftRail";
import type { PersistedFlightPlan } from "@/features/flight-planner/stores/useFlightStore";
import { ProjectsWorkspacePanel } from "@/features/projects/components/ProjectsWorkspacePanel";
import { useProjects } from "@/features/projects/hooks/useProjects";
import { ResultsMapToolsOverlay } from "@/features/results/components/ResultsMapToolsOverlay";
import { ResultsWorkspacePanel } from "@/features/results/components/ResultsWorkspacePanel";
import { useResultsViewStore } from "@/features/results/stores/useResultsViewStore";
import { UploadWorkspacePanel } from "@/features/upload/components/UploadWorkspacePanel";
import { ProcessingQueuePanel } from "@/features/processing-queue/components/ProcessingQueuePanel";
import { WindIndicatorOverlay } from "@/features/flight-planner/components/WindIndicatorOverlay";
import type { DeviceTier } from "@/features/map-engine/utils/detectDeviceTier";
import { type WorkspacePanelId, parseWorkspacePanel } from "@/constants/routes";
import {
  glassSurfaceClass,
  maybeBackdropBlur,
  useDeviceTier,
} from "@/lib/deviceUtils";
import { cn } from "@/lib/utils";
import { useFlightStore } from "@/features/flight-planner/stores/useFlightStore";
import { useMapEngine } from "@/features/map-engine/useMapEngine";
import { MapControls3D } from "@/features/map-engine/components/MapControls3D";
import { PenStylusShadow } from "@/components/ui/PenStylusShadow";
import { Button } from "@/components/ui/Button";
import { Maximize2 } from "lucide-react";

const PANEL_TITLES: Record<
  WorkspacePanelId,
  { title: string; subtitle?: string }
> = {
  projects: {
    title: "Projetos",
    subtitle: "Escolha um projeto ou crie um novo; o mapa permanece no fundo.",
  },
  plan: { title: "Planejador de voo" },
  upload: { title: "Upload de imagens" },
  results: { title: "Resultados e entregas" },
  queue: {
    title: "Fila de processamento",
    subtitle: "Workers Celery, tarefas NodeODM e projetos em fila.",
  },
  settings: { title: "Configuracoes" },
};

function renderWorkspacePanel(
  panel: WorkspacePanelId,
  ctx: {
    projectId: string | null;
    project: ReturnType<ReturnType<typeof useProjects>["getProject"]>;
    initialPlan: PersistedFlightPlan | null;
    saveFlightPlan: ReturnType<typeof useProjects>["saveFlightPlan"];
    planFloatingHeaderRight?: ReactNode;
    plannerShell?: FlightPlannerShellProps;
    deviceTier: DeviceTier;
  },
) {
  const {
    projectId,
    project,
    initialPlan,
    saveFlightPlan,
    planFloatingHeaderRight,
    plannerShell,
    deviceTier,
  } = ctx;
  const { title, subtitle } = PANEL_TITLES[panel];

  if (panel === "projects") {
    return (
      <FloatingPanel title={title} subtitle={subtitle}>
        <ProjectsWorkspacePanel />
      </FloatingPanel>
    );
  }

  if (panel === "settings") {
    return (
      <FloatingPanel title={title} subtitle="Preferencias e contexto da API.">
        <SettingsForm />
      </FloatingPanel>
    );
  }

  if (panel === "queue") {
    return (
      <FloatingPanel title={title} subtitle={subtitle}>
        <ProcessingQueuePanel />
      </FloatingPanel>
    );
  }

  if (panel === "plan") {
    if (!projectId) {
      return (
        <FloatingPanel title={title} subtitle="Associe um projeto">
          <p className="text-sm text-[#b4b4b4]">
            Selecione um projeto no seletor da barra superior para editar a area
            de voo, parametros e exportacao KMZ.
          </p>
        </FloatingPanel>
      );
    }
    if (!project) {
      return (
        <FloatingPanel
          title="Projeto nao encontrado"
          subtitle="Verifique a lista de projetos."
        >
          <p className="text-sm text-[#b4b4b4]">
            Este ID nao corresponde a nenhum projeto no workspace atual.
          </p>
        </FloatingPanel>
      );
    }
    if (!plannerShell) {
      throw new Error("plannerShell is required for plan panel with a project");
    }
    return (
      <FloatingPanel
        key={projectId}
        title={title}
        subtitle={project.name}
        className={cn(glassSurfaceClass(deviceTier), "!border-white/10")}
        headerRight={planFloatingHeaderRight}
      >
        <FlightPlannerConfigPanel
          projectName={project.name}
          projectId={projectId}
          initialPlan={initialPlan}
          plannerShell={plannerShell}
          onSavePlan={async (p) => {
            await saveFlightPlan(projectId, p);
          }}
        />
      </FloatingPanel>
    );
  }

  if (panel === "upload") {
    return (
      <FloatingPanel title={title} subtitle={project?.name}>
        <UploadWorkspacePanel projectId={projectId} />
      </FloatingPanel>
    );
  }

  if (panel === "results") {
    if (!projectId) {
      return (
        <FloatingPanel title={title} subtitle="Associe um projeto">
          <p className="text-sm text-[#b4b4b4]">
            Selecione um projeto no topo para acompanhar processamento e
            entregas.
          </p>
        </FloatingPanel>
      );
    }
    if (!project) {
      return (
        <FloatingPanel
          title="Projeto nao encontrado"
          subtitle="Verifique a lista de projetos."
        >
          <p className="text-sm text-[#b4b4b4]">
            Este ID nao corresponde a nenhum projeto no workspace atual.
          </p>
        </FloatingPanel>
      );
    }
    return (
      <FloatingPanel key={projectId} title={title} subtitle={project.name}>
        <ResultsWorkspacePanel projectId={projectId} />
      </FloatingPanel>
    );
  }

  return null;
}

export function WorkspacePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const deviceTier = useDeviceTier();
  const [isRightPanelTransitionPending, startPanelTransition] = useTransition();
  const onRightPanelOpenChange = useCallback(
    (open: boolean) => {
      startPanelTransition(() => {
        setRightPanelOpen(open);
      });
    },
    [startPanelTransition, setRightPanelOpen],
  );
  const { getProject, saveFlightPlan } = useProjects();
  const panel = parseWorkspacePanel(searchParams.get("panel"));
  const projectId = searchParams.get("project");
  const resetResultsUi = useResultsViewStore((s) => s.reset);

  const project = projectId ? getProject(projectId) : undefined;
  const polygon = useFlightStore((s) => s.polygon);

  const [expandedPlannerOpen, setExpandedPlannerOpen] = useState(
    () => readPlannerShellPrefs().expandedOpen,
  );
  const [expandedPlannerTab, setExpandedPlannerTab] =
    useState<PlannerExpandedTabId>(() => readPlannerShellPrefs().activeTab);

  useEffect(() => {
    writePlannerShellPrefs({
      expandedOpen: expandedPlannerOpen,
      activeTab: expandedPlannerTab,
    });
  }, [expandedPlannerOpen, expandedPlannerTab]);

  useEffect(() => {
    if (!projectId) return;
    const p = readPlannerShellPrefs();
    setExpandedPlannerOpen(p.expandedOpen);
    setExpandedPlannerTab(p.activeTab);
  }, [projectId]);

  useEffect(() => {
    if (!searchParams.get("panel")) {
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.set("panel", "projects");
          return n;
        },
        { replace: true },
      );
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (panel !== "results") resetResultsUi();
  }, [panel, resetResultsUi]);

  const initialPlan: PersistedFlightPlan | null = !project?.flightPlan
    ?.plannerData
    ? null
    : (project.flightPlan.plannerData as PersistedFlightPlan);

  const collapsedLabel =
    panel === "queue"
      ? PANEL_TITLES[panel].title
      : project?.name
        ? `${PANEL_TITLES[panel].title} — ${project.name}`
        : PANEL_TITLES[panel].title;

  const showPlanChrome = panel === "plan" && Boolean(projectId);
  const showResultsChrome = panel === "results" && Boolean(projectId);
  const mapWeather = useWorkspaceMapWeather();
  useWeatherMapLayerZoomClamp(mapWeather.overlay);
  const hasManualWaypoints = useFlightStore((s) => s.hasManualWaypoints);
  const manualWaypointsBannerVisible = useFlightStore(
    (s) => s.manualWaypointsBannerVisible,
  );
  const setManualWaypointsBannerVisible = useFlightStore(
    (s) => s.setManualWaypointsBannerVisible,
  );
  const clearManualWaypoints = useFlightStore((s) => s.clearManualWaypoints);
  const plannerInteractionMode = useFlightStore(
    (s) => s.plannerInteractionMode,
  );
  const { mode, setBearing, changePitch, changeZoom } = useMapEngine();

  const [isLandscape, setIsLandscape] = useState(
    () =>
      typeof window !== "undefined" && window.innerWidth > window.innerHeight,
  );
  const landscapeHandlerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  useEffect(() => {
    const handler = () => {
      if (landscapeHandlerRef.current)
        clearTimeout(landscapeHandlerRef.current);
      landscapeHandlerRef.current = setTimeout(() => {
        setIsLandscape(window.innerWidth > window.innerHeight);
      }, 100);
    };
    window.addEventListener("resize", handler);
    window.addEventListener("orientationchange", handler);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("orientationchange", handler);
      if (landscapeHandlerRef.current)
        clearTimeout(landscapeHandlerRef.current);
    };
  }, []);

  // CSS custom property: width of the right panel so overlays can avoid it.
  const rightPanelWidth = rightPanelOpen
    ? "var(--layout-panel-width, 32rem)"
    : "0px";

  // Portais (ex.: planejador expandido) ficam sob `body` e não herdam o `div` do workspace.
  const planDrawBannerActive =
    showPlanChrome && plannerInteractionMode === "draw";

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--right-panel-width", rightPanelWidth);
    root.style.setProperty("--left-sidebar-width", "3rem");
    root.style.setProperty(
      "--topbar-height",
      planDrawBannerActive ? "calc(3.5rem + 1.875rem)" : "3.5rem",
    );
    return () => {
      root.style.removeProperty("--right-panel-width");
      root.style.removeProperty("--left-sidebar-width");
      root.style.removeProperty("--topbar-height");
    };
  }, [rightPanelWidth, planDrawBannerActive]);

  const plannerMapChromeTop = planDrawBannerActive
    ? "calc(max(4.5rem, calc(3.5rem + var(--safe-area-top))) + 1.875rem)"
    : "max(4.5rem, calc(3.5rem + var(--safe-area-top)))";

  const plannerShellForPlan: FlightPlannerShellProps | undefined =
    panel === "plan" && projectId && project
      ? {
          expandedOpen: expandedPlannerOpen,
          onExpandedOpenChange: setExpandedPlannerOpen,
          expandedTab: expandedPlannerTab,
          onExpandedTabChange: setExpandedPlannerTab,
        }
      : undefined;

  const planFloatingHeaderRight =
    panel === "plan" && projectId && project && polygon ? (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="size-9 shrink-0 p-0 text-neutral-400 hover:bg-white/10 hover:text-neutral-100"
        aria-label="Abrir planejador completo"
        title="Abrir planejador completo"
        onClick={() => {
          setExpandedPlannerTab("mission");
          setExpandedPlannerOpen(true);
        }}
      >
        <Maximize2 className="size-4" aria-hidden />
      </Button>
    ) : undefined;

  const mainPanel = renderWorkspacePanel(panel, {
    projectId,
    project,
    initialPlan,
    saveFlightPlan,
    planFloatingHeaderRight,
    plannerShell: plannerShellForPlan,
    deviceTier,
  });

  return (
    <div
      className="fixed inset-0 z-0 overflow-hidden bg-[#0f0f0f] text-[#fafafa]"
      style={
        {
          "--right-panel-width": rightPanelWidth,
          "--left-sidebar-width": "3rem",
          "--topbar-height": planDrawBannerActive
            ? "calc(3.5rem + 1.875rem)"
            : "3.5rem",
        } as React.CSSProperties
      }
    >
      <PenStylusShadow />
      <div className="absolute inset-0 z-0">
        {showPlanChrome ? <FlightPlannerCalculationBridge /> : null}
        <WorkspaceMapView
          panel={panel}
          projectId={projectId}
          weatherTiles={{
            overlay: mapWeather.overlay,
            openWeatherApiKey: mapWeather.openWeatherApiKey,
            onRadarStatus: mapWeather.onRadarStatus,
          }}
        />
      </div>

      <div
        className="pointer-events-none absolute inset-0 z-[5]"
        aria-hidden={!(showPlanChrome || showResultsChrome)}
      >
        {showResultsChrome ? <ResultsMapToolsOverlay /> : null}
      </div>

      {showPlanChrome && projectId ? (
        <div
          className="pointer-events-none absolute z-[44] flex max-w-[min(100%,20rem)] flex-col"
          style={{
            top: plannerMapChromeTop,
            left: "calc(max(0.75rem, env(safe-area-inset-left, 0px)) + 3.25rem)",
            bottom: "max(6rem, calc(0.75rem + var(--safe-area-bottom, 0px)))",
          }}
        >
          <WaypointEditorPanel />
        </div>
      ) : null}

      {showPlanChrome ? (
        <div
          className="pointer-events-none absolute z-50 flex min-h-0 max-h-full flex-col overflow-visible"
          style={{
            top: plannerMapChromeTop,
            left: "max(0.75rem, env(safe-area-inset-left, 0px))",
            bottom: "max(6rem, calc(0.75rem + var(--safe-area-bottom, 0px)))",
          }}
        >
          <WorkspaceMapLeftRail
            variant="plan"
            projectId={projectId}
            overlay={mapWeather.overlay}
            setOverlay={mapWeather.setOverlay}
            openWeatherApiKey={mapWeather.openWeatherApiKey}
            radarStatus={mapWeather.radarStatus}
            radarMessage={mapWeather.radarMessage}
          />
        </div>
      ) : null}

      {showResultsChrome ? (
        <div
          className="pointer-events-none absolute z-50 flex min-h-0 max-h-full flex-col overflow-visible"
          style={{
            top: "max(4.5rem, calc(3.5rem + var(--safe-area-top)))",
            left: "max(0.75rem, env(safe-area-inset-left, 0px))",
            bottom: "max(6rem, calc(0.75rem + var(--safe-area-bottom, 0px)))",
          }}
        >
          <WorkspaceMapLeftRail variant="results" />
        </div>
      ) : null}

      {/* WindIndicator + MapControls3D stacked above it */}
      {showPlanChrome ? (
        <div
          className="pointer-events-none absolute z-[44] flex flex-col items-end gap-2"
          style={{
            right: "calc(var(--right-panel-width) + 0.75rem)",
            bottom: "max(6rem, calc(0.75rem + var(--safe-area-bottom, 0px)))",
          }}
        >
          <MapControls3D
            visible={mode === "3d" && isLandscape}
            onBearingReset={() => setBearing(0)}
            onPitchChange={(delta) => changePitch(delta)}
            onZoom={(delta) => changeZoom(delta)}
          />
          <WindIndicatorOverlay />
        </div>
      ) : null}

      {/* Banner: plano modificado manualmente */}
      {showPlanChrome && hasManualWaypoints && manualWaypointsBannerVisible ? (
        <div
          className={cn(
            "pointer-events-auto absolute z-[55] flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-300 shadow-lg",
            maybeBackdropBlur(deviceTier, "sm"),
          )}
          style={{
            top: "max(4.5rem, calc(3.5rem + var(--safe-area-top)))",
            left: "50%",
            transform: "translateX(-50%)",
          }}
          role="status"
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
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>Plano modificado manualmente</span>
          <button
            type="button"
            className="rounded-lg border border-amber-500/40 bg-amber-500/20 px-3 py-1 text-xs font-medium transition hover:bg-amber-500/30"
            onClick={clearManualWaypoints}
          >
            Recalcular
          </button>
          <button
            type="button"
            className="rounded-lg p-1 transition hover:bg-amber-500/20"
            onClick={() => setManualWaypointsBannerVisible(false)}
            aria-label="Fechar banner"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              aria-hidden
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : null}

      <WorkspaceTopBar />

      <div
        className="pointer-events-none absolute left-0 right-0 z-40 p-3 sm:p-4"
        style={{
          top: "max(3.5rem, calc(3.5rem + var(--safe-area-top)))",
          bottom: "max(0.75rem, var(--safe-area-bottom))",
          paddingLeft: "max(0.75rem, env(safe-area-inset-left, 0px))",
          paddingRight: "max(0.75rem, env(safe-area-inset-right, 0px))",
        }}
      >
        <div
          className={cn(
            // Com painel fechado, nao cobrir o mapa: so filhos com pointer-events-auto
            // (barra / botao de reabrir) recebem toque; o restante passa ao mapa.
            rightPanelOpen ? "pointer-events-auto" : "pointer-events-none",
            "flex h-full w-full min-w-0 min-h-0 flex-col justify-end",
            "lg:ml-auto lg:max-w-lg lg:items-stretch lg:justify-start",
            "landscape:min-h-0",
          )}
        >
          <WorkspaceLayoutPanel
            collapsedLabel={collapsedLabel}
            onOpenChange={onRightPanelOpenChange}
            transitionPending={isRightPanelTransitionPending}
          >
            {mainPanel}
          </WorkspaceLayoutPanel>
        </div>
      </div>
    </div>
  );
}
