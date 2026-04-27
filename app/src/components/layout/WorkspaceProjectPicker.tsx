import { useMemo, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";

type ProjectOption = { id: string; name: string };

type WorkspaceProjectPickerProps = {
  projects: ProjectOption[];
  projectId: string | null;
};

export function WorkspaceProjectPicker({
  projects,
  projectId,
}: WorkspaceProjectPickerProps) {
  const [, setSearchParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setQuery("");
  };

  const selectedLabel = useMemo(() => {
    if (!projectId) return "Projeto: todos";
    const p = projects.find((x) => x.id === projectId);
    return p?.name ?? "Projeto";
  }, [projectId, projects]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => p.name.toLowerCase().includes(q));
  }, [projects, query]);

  const setProject = (id: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set("project", id);
        else next.delete("project");
        if (!next.get("panel")) next.set("panel", "projects");
        return next;
      },
      { replace: true },
    );
    setOpen(false);
    setQuery("");
  };

  const goNewProject = () => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("panel", "projects");
        return next;
      },
      { replace: true },
    );
    setOpen(false);
    setQuery("");
  };

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          id="workspace-project"
          aria-label="Projeto ativo"
          aria-haspopup="dialog"
          className={cn(
            "touch-target flex h-11 min-h-11 w-full max-w-[11rem] cursor-pointer items-center justify-between gap-2 rounded-full border border-[#2e2e2e] bg-[#0f0f0f] pl-3 pr-2 text-left text-sm text-[#fafafa] outline-none transition focus-visible:border-[rgba(62,207,142,0.4)] sm:max-w-[16rem] md:max-w-xs",
          )}
        >
          <span className="min-w-0 flex-1 truncate">{selectedLabel}</span>
          <ChevronDown
            className="size-4 shrink-0 text-[#898989]"
            aria-hidden
          />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className={cn(
            "z-[100] flex max-h-[min(70dvh,28rem)] w-[min(calc(100vw-1.5rem),20rem)] flex-col rounded-xl border border-[#2e2e2e] bg-[rgba(26,26,26,0.97)] shadow-[0_16px_48px_rgba(0,0,0,0.55)] outline-none animate-fade-in",
          )}
        >
          <div className="shrink-0 border-b border-[#242424] p-2">
            <label htmlFor="workspace-project-search" className="sr-only">
              Buscar projeto
            </label>
            <input
              id="workspace-project-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar projeto…"
              className="input-base w-full py-2.5 text-sm"
              autoComplete="off"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1 [scrollbar-gutter:stable]">
            <button
              type="button"
              onClick={() => setProject("")}
              className={cn(
                "flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm transition",
                !projectId
                  ? "bg-[rgba(62,207,142,0.12)] text-[#fafafa]"
                  : "text-[#b4b4b4] hover:bg-white/[0.06] hover:text-[#fafafa]",
              )}
            >
              Projeto: todos
            </button>
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-[#737373]">
                Nenhum projeto corresponde à busca.
              </p>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProject(p.id)}
                  className={cn(
                    "flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm transition",
                    projectId === p.id
                      ? "bg-[rgba(62,207,142,0.12)] text-[#fafafa]"
                      : "text-[#b4b4b4] hover:bg-white/[0.06] hover:text-[#fafafa]",
                  )}
                >
                  <span className="truncate">{p.name}</span>
                </button>
              ))
            )}
          </div>
          <div className="shrink-0 border-t border-[#242424] p-1">
            <button
              type="button"
              onClick={goNewProject}
              className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-medium text-[#3ecf8e] transition hover:bg-white/[0.06]"
            >
              <Plus className="size-4 shrink-0" aria-hidden />
              Novo projeto
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
