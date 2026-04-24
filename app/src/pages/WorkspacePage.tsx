import { useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { FloatingPanel } from "@/components/ui/FloatingPanel"
import { WorkspaceMapView } from "@/components/map/WorkspaceMapView"
import { WorkspaceLayoutPanel } from "@/components/layout/WorkspaceLayoutPanel"
import { WorkspaceTopBar } from "@/components/layout/WorkspaceTopBar"
import { SettingsForm } from "@/components/workspace/SettingsForm"
import { FlightPlannerConfigPanel } from "@/features/flight-planner/components/FlightPlannerConfigPanel"
import { FlightPlannerMapToolbar } from "@/features/flight-planner/components/FlightPlannerMapToolbar"
import type { PersistedFlightPlan } from "@/features/flight-planner/stores/useFlightStore"
import { ProjectsWorkspacePanel } from "@/features/projects/components/ProjectsWorkspacePanel"
import { useProjects } from "@/features/projects/hooks/useProjects"
import { ResultsMapToolsOverlay } from "@/features/results/components/ResultsMapToolsOverlay"
import { ResultsWorkspacePanel } from "@/features/results/components/ResultsWorkspacePanel"
import { useResultsViewStore } from "@/features/results/stores/useResultsViewStore"
import { UploadWorkspacePanel } from "@/features/upload/components/UploadWorkspacePanel"
import { type WorkspacePanelId, parseWorkspacePanel } from "@/constants/routes"
import { cn } from "@/lib/utils"

const PANEL_TITLES: Record<
  WorkspacePanelId,
  { title: string; subtitle?: string }
> = {
  projects: {
    title: "Projetos",
    subtitle:
      "Escolha um projeto ou crie um novo; o mapa permanece no fundo.",
  },
  plan: { title: "Planejador de voo" },
  upload: { title: "Upload de imagens" },
  results: { title: "Resultados e entregas" },
  settings: { title: "Configuracoes" },
}

function renderWorkspacePanel(
  panel: WorkspacePanelId,
  ctx: {
    projectId: string | null
    project: ReturnType<ReturnType<typeof useProjects>["getProject"]>
    initialPlan: PersistedFlightPlan | null
    saveFlightPlan: ReturnType<typeof useProjects>["saveFlightPlan"]
  },
) {
  const { projectId, project, initialPlan, saveFlightPlan } = ctx
  const { title, subtitle } = PANEL_TITLES[panel]

  if (panel === "projects") {
    return (
      <FloatingPanel
        title={title}
        subtitle={subtitle}
      >
        <ProjectsWorkspacePanel />
      </FloatingPanel>
    )
  }

  if (panel === "settings") {
    return (
      <FloatingPanel
        title={title}
        subtitle="Preferencias e contexto da API."
      >
        <SettingsForm />
      </FloatingPanel>
    )
  }

  if (panel === "plan") {
    if (!projectId) {
      return (
        <FloatingPanel
          title={title}
          subtitle="Associe um projeto"
        >
          <p className="text-sm text-[#b4b4b4]">
            Selecione um projeto no seletor da barra superior para editar a area
            de voo, parametros e exportacao KMZ.
          </p>
        </FloatingPanel>
      )
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
      )
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
            await saveFlightPlan(projectId, p)
          }}
        />
      </FloatingPanel>
    )
  }

  if (panel === "upload") {
    return (
      <FloatingPanel
        title={title}
        subtitle={project?.name}
      >
        <UploadWorkspacePanel projectId={projectId} />
      </FloatingPanel>
    )
  }

  if (panel === "results") {
    if (!projectId) {
      return (
        <FloatingPanel
          title={title}
          subtitle="Associe um projeto"
        >
          <p className="text-sm text-[#b4b4b4]">
            Selecione um projeto no topo para acompanhar processamento e
            entregas.
          </p>
        </FloatingPanel>
      )
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
      )
    }
    return (
      <FloatingPanel
        key={projectId}
        title={title}
        subtitle={project.name}
      >
        <ResultsWorkspacePanel projectId={projectId} />
      </FloatingPanel>
    )
  }

  return null
}

export function WorkspacePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { getProject, saveFlightPlan } = useProjects()
  const panel = parseWorkspacePanel(searchParams.get("panel"))
  const projectId = searchParams.get("project")
  const resetResultsUi = useResultsViewStore((s) => s.reset)

  const project = projectId ? getProject(projectId) : undefined

  useEffect(() => {
    if (!searchParams.get("panel")) {
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev)
          n.set("panel", "projects")
          return n
        },
        { replace: true },
      )
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (panel !== "results") resetResultsUi()
  }, [panel, resetResultsUi])

  const initialPlan: PersistedFlightPlan | null =
    !project?.flightPlan?.plannerData
      ? null
      : (project.flightPlan.plannerData as PersistedFlightPlan)

  const collapsedLabel = project?.name
    ? `${PANEL_TITLES[panel].title} — ${project.name}`
    : PANEL_TITLES[panel].title

  const showPlanChrome = panel === "plan" && Boolean(projectId)
  const showResultsChrome = panel === "results" && Boolean(projectId)

  const mainPanel = renderWorkspacePanel(panel, {
    projectId,
    project,
    initialPlan,
    saveFlightPlan,
  })

  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-[#0f0f0f] text-[#fafafa]">
      <div className="absolute inset-0 z-0">
        <WorkspaceMapView
          panel={panel}
          projectId={projectId}
        />
      </div>

      <div
        className="pointer-events-none absolute inset-0 z-[5]"
        aria-hidden={!(showPlanChrome || showResultsChrome)}
      >
        {showPlanChrome ? (
          <div
            className={cn("pointer-events-auto absolute z-[2000]")}
            style={{
              top: "max(4.5rem, calc(3.5rem + var(--safe-area-top)))",
              left: "max(1rem, env(safe-area-inset-left, 0px))",
            }}
          >
            <div className="glass-toolbar max-w-[min(20rem,calc(100vw-2rem-max(1rem,env(safe-area-inset-left,0px))-max(1rem,env(safe-area-inset-right,0px))))]">
              <FlightPlannerMapToolbar />
            </div>
          </div>
        ) : null}
        {showResultsChrome ? <ResultsMapToolsOverlay /> : null}
      </div>

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
            "pointer-events-auto flex h-full w-full min-w-0 min-h-0 flex-col justify-end",
            "lg:ml-auto lg:max-w-lg lg:items-stretch lg:justify-start",
            "landscape:min-h-0",
          )}
        >
          <WorkspaceLayoutPanel collapsedLabel={collapsedLabel}>
            {mainPanel}
          </WorkspaceLayoutPanel>
        </div>
      </div>
    </div>
  )
}
