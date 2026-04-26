import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FloatingPanel } from "@/components/ui/FloatingPanel";
import { WorkspaceMapView } from "@/components/map/WorkspaceMapView";
import { WeatherLayerMapControls } from "@/components/map/WeatherLayerMapControls";
import { useWorkspaceMapWeather } from "@/components/map/useWorkspaceMapWeather";
import { WorkspaceLayoutPanel } from "@/components/layout/WorkspaceLayoutPanel";
import { WorkspaceTopBar } from "@/components/layout/WorkspaceTopBar";
import { SettingsForm } from "@/components/workspace/SettingsForm";
import { FlightPlannerCalculationBridge } from "@/features/flight-planner/components/FlightPlannerCalculationBridge";
import { WaypointEditorPanel } from "@/features/flight-planner/components/WaypointEditorPanel";
import { FlightPlannerConfigPanel } from "@/features/flight-planner/components/FlightPlannerConfigPanel";
import { PlannerIconSidebar } from "@/features/flight-planner/components/PlannerIconSidebar";
import type { PersistedFlightPlan } from "@/features/flight-planner/stores/useFlightStore";
import { ProjectsWorkspacePanel } from "@/features/projects/components/ProjectsWorkspacePanel";
import { useProjects } from "@/features/projects/hooks/useProjects";
import { ResultsMapToolsOverlay } from "@/features/results/components/ResultsMapToolsOverlay";
import { ResultsWorkspacePanel } from "@/features/results/components/ResultsWorkspacePanel";
import { useResultsViewStore } from "@/features/results/stores/useResultsViewStore";
import { UploadWorkspacePanel } from "@/features/upload/components/UploadWorkspacePanel";
import { ProcessingQueuePanel } from "@/features/processing-queue/components/ProcessingQueuePanel";
import { WindIndicatorOverlay } from "@/features/flight-planner/components/WindIndicatorOverlay";
import { type WorkspacePanelId, parseWorkspacePanel } from "@/constants/routes";
import { cn } from "@/lib/utils";

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
  },
) {
  const { projectId, project, initialPlan, saveFlightPlan } = ctx;
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
    return (
      <FloatingPanel
        key={projectId}
        title={title}
        subtitle={project.name}
        className="glass-surface !border-white/10"
      >
        <FlightPlannerConfigPanel
          projectName={project.name}
          projectId={projectId}
          initialPlan={initialPlan}
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
  const { getProject, saveFlightPlan } = useProjects();
  const panel = parseWorkspacePanel(searchParams.get("panel"));
  const projectId = searchParams.get("project");
  const resetResultsUi = useResultsViewStore((s) => s.reset);

  const project = projectId ? getProject(projectId) : undefined;

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

  // CSS custom property: width of the right panel so overlays can avoid it.
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const rightPanelWidth = rightPanelOpen
    ? "var(--layout-panel-width, 32rem)"
    : "0px";

  // Portais (ex.: planejador expandido) ficam sob `body` e não herdam o `div` do workspace.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--right-panel-width", rightPanelWidth);
    root.style.setProperty("--left-sidebar-width", "3rem");
    root.style.setProperty("--topbar-height", "3.5rem");
    return () => {
      root.style.removeProperty("--right-panel-width");
      root.style.removeProperty("--left-sidebar-width");
      root.style.removeProperty("--topbar-height");
    };
  }, [rightPanelWidth]);

  const mainPanel = renderWorkspacePanel(panel, {
    projectId,
    project,
    initialPlan,
    saveFlightPlan,
  });

  return (
    <div
      className="fixed inset-0 z-0 overflow-hidden bg-[#0f0f0f] text-[#fafafa]"
      style={
        {
          "--right-panel-width": rightPanelWidth,
          "--left-sidebar-width": "3rem",
          "--topbar-height": "3.5rem",
        } as React.CSSProperties
      }
    >
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
            top: "max(4.5rem, calc(3.5rem + var(--safe-area-top)))",
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
            top: "max(4.5rem, calc(3.5rem + var(--safe-area-top)))",
            left: "max(0.75rem, env(safe-area-inset-left, 0px))",
            bottom: "max(6rem, calc(0.75rem + var(--safe-area-bottom, 0px)))",
          }}
        >
          <PlannerIconSidebar
            overlay={mapWeather.overlay}
            setOverlay={mapWeather.setOverlay}
            openWeatherApiKey={mapWeather.openWeatherApiKey}
            radarStatus={mapWeather.radarStatus}
            radarMessage={mapWeather.radarMessage}
          />
        </div>
      ) : null}

      {/* WindIndicator lives here so it respects --right-panel-width */}
      {showPlanChrome ? (
        <div
          className="pointer-events-none absolute z-[44]"
          style={{
            right: "calc(var(--right-panel-width) + 0.75rem)",
            bottom: "max(6rem, calc(0.75rem + var(--safe-area-bottom, 0px)))",
          }}
        >
          <WindIndicatorOverlay />
        </div>
      ) : null}

      {!showPlanChrome ? (
        <div className="pointer-events-none absolute inset-0 z-[36]">
          <div
            className="pointer-events-auto absolute flex flex-col gap-2"
            style={{
              left: "max(0.75rem, env(safe-area-inset-left, 0px))",
              bottom: showResultsChrome
                ? "max(10.5rem, calc(0.75rem + var(--safe-area-bottom, 0px)))"
                : "max(6rem, calc(0.75rem + var(--safe-area-bottom, 0px)))",
            }}
          >
            <WeatherLayerMapControls
              placement="mapBottomLeft"
              overlay={mapWeather.overlay}
              setOverlay={mapWeather.setOverlay}
              openWeatherApiKey={mapWeather.openWeatherApiKey}
              radarStatus={mapWeather.radarStatus}
              radarMessage={mapWeather.radarMessage}
            />
          </div>
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
            onOpenChange={setRightPanelOpen}
          >
            {mainPanel}
          </WorkspaceLayoutPanel>
        </div>
      </div>
    </div>
  );
}
