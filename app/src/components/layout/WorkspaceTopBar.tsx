import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  type WorkspacePanelId,
  parseWorkspacePanel,
} from '@/constants/routes'
import { useProjects } from '@/features/projects/hooks/useProjects'
import { WorkspaceProjectPicker } from '@/components/layout/WorkspaceProjectPicker'

const NAV: { id: WorkspacePanelId; label: string; needsProject?: boolean }[] = [
  { id: "projects", label: "Projetos" },
  { id: "plan", label: "Planejador", needsProject: true },
  { id: "upload", label: "Upload", needsProject: true },
  { id: "results", label: "Resultados", needsProject: true },
  { id: "queue", label: "Fila ODM" },
  { id: "settings", label: "Config" },
]

export function WorkspaceTopBar() {
  const { projects } = useProjects()
  const [searchParams, setSearchParams] = useSearchParams()
  const panel = parseWorkspacePanel(searchParams.get("panel"))
  const projectId = searchParams.get("project")
  const projectOptions = useMemo(
    () => projects.map((p) => ({ id: p.id, name: p.name })),
    [projects],
  )

  const goPanel = (next: WorkspacePanelId) => {
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev)
        n.set("panel", next)
        return n
      },
      { replace: true },
    )
  }

  return (
    <header
      className={cn(
        "pointer-events-auto absolute left-0 right-0 top-0 z-50",
        "border-b border-[#242424] bg-[#171717]/90 backdrop-blur-md",
      )}
      style={{ paddingTop: "var(--safe-area-top)" }}
    >
      <div className="mx-auto flex h-14 max-w-[2000px] items-center gap-3 px-3 md:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
          <div className="hidden shrink-0 items-baseline gap-1.5 border-r border-[#2e2e2e] pr-3 sm:flex">
            <span className="text-sm font-medium tracking-[-0.2px] text-[#fafafa]">
              DroneData
            </span>
            <span
              className="font-mono text-[10px] uppercase tracking-[1.2px] text-[#3ecf8e]"
              aria-hidden
            >
              beta
            </span>
          </div>

          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-0.5 pr-1 [scrollbar-width:none] md:gap-1.5 [&::-webkit-scrollbar]:hidden">
            {NAV.map((item) => {
              const active = panel === item.id
              const needs = item.needsProject && !projectId
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={Boolean(needs)}
                  onClick={() => {
                    if (needs) return
                    goPanel(item.id)
                  }}
                  className={cn(
                    "touch-target shrink-0 rounded-full border px-3 text-sm font-medium transition",
                    "disabled:cursor-not-allowed disabled:opacity-40",
                    active
                      ? "border-[rgba(62,207,142,0.35)] bg-[#0f0f0f] text-[#fafafa]"
                      : "border-[#2e2e2e] bg-transparent text-[#b4b4b4] hover:border-[#393939] hover:text-[#fafafa]",
                  )}
                  title={
                    needs
                      ? "Selecione um projeto no seletor ao lado"
                      : item.id === "queue"
                        ? "Fila Celery e tarefas NodeODM"
                        : item.label
                  }
                >
                  {item.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="relative flex shrink-0 items-center">
          <WorkspaceProjectPicker
            projects={projectOptions}
            projectId={projectId}
          />
        </div>
      </div>
    </header>
  )
}
