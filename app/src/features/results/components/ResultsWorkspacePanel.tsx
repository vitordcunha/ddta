import { Suspense, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Boxes, RefreshCw, Trash2 } from "lucide-react";
import type { ProjectStatus } from "@/types/project";
import { Badge, Button, Card } from "@/components/ui";
import { DownloadPanel } from "@/features/results/components/DownloadPanel";
import { LayerSelector } from "@/features/results/components/LayerSelector";
import { ProcessingStatsGrid } from "@/features/results/components/ProcessingStatsGrid";
import { ProcessingView } from "@/features/results/components/ProcessingView";
import { ResultRunLayersPanel } from "@/features/results/components/ResultRunLayersPanel";
import { PointCloudViewer } from "@/features/results/components/PointCloudViewer";
import { StartProcessingPanel } from "@/features/results/components/StartProcessingPanel";
import { useMapAutoBounds } from "@/features/results/hooks/useMapAutoBounds";
import { useProjectStatus } from "@/features/results/hooks/useProjectStatus";
import { useResultsViewStore } from "@/features/results/stores/useResultsViewStore";
import type { ProcessingPreset } from "@/features/results/types";
import { extractCompletedStats } from "@/features/results/utils/extractCompletedStats";
import { ProjectPurgeModal } from "@/features/projects/components/ProjectPurgeModal";
import { useProjects } from "@/features/projects/hooks/useProjects";
import { SparseCloudViewer } from "@/features/sparse-cloud";
import { projectsService } from "@/services/projectsService";
import { MapRouteDeckVisibilityToggles } from "@/features/map-engine/components/MapRouteDeckVisibilityToggles";

type ResultsWorkspacePanelProps = {
  projectId: string;
};

export function ResultsWorkspacePanel({
  projectId,
}: ResultsWorkspacePanelProps) {
  const { getProject } = useProjects();
  const listProject = getProject(projectId);
  const resetResultsView = useResultsViewStore((s) => s.reset);

  const { data: projectDetail } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => projectsService.getById(projectId),
    enabled: Boolean(projectId),
  });

  const project = projectDetail ?? listProject;

  useEffect(() => {
    resetResultsView();
  }, [projectId, resetResultsView]);

  const initialStatus = useMemo(() => {
    if (!listProject) return "uploading" as const;
    const s = listProject.status as
      | ProjectStatus
      | "queued"
      | "cancelled"
      | "canceled";
    if (s === "processing" || s === "queued") return "processing" as const;
    if (s === "completed") return "completed" as const;
    if (s === "failed" || s === "cancelled" || s === "canceled")
      return "failed" as const;
    return "uploading" as const;
  }, [listProject]);

  const {
    status,
    progress,
    message,
    eta,
    logs,
    previewStatus,
    previewProgress,
    sparseCloudAvailable,
    sparseCloudTrackProgress,
    sparseCloudTrackHint,
    startProcessing,
    cancelProcessing,
    finalizeStuckMain,
    finalizeStuckPreview,
  } = useProjectStatus(projectId, initialStatus);
  const [preset, setPreset] = useState<ProcessingPreset>("standard");
  const [enablePreview, setEnablePreview] = useState(false);
  const [redoPanelOpen, setRedoPanelOpen] = useState(false);
  const [purgeModalOpen, setPurgeModalOpen] = useState(false);
  const [cloudViewerOpen, setCloudViewerOpen] = useState(false);

  useEffect(() => {
    if (status === "processing") setRedoPanelOpen(false);
  }, [status]);

  // Increment version whenever image count, assets, or completion state changes so the map auto-fits.
  // imageCount is the primary trigger: as soon as images with GPS are uploaded the map should move.
  const assetVersion = useMemo(() => {
    let v = project?.imageCount ?? 0;
    if (project?.assets) v += 10000;
    if (status === "completed") v += 20000;
    if (previewStatus === "completed") v += 40000;
    v += (project?.processingRuns.length ?? 0) * 3;
    v += (project?.previewRuns.length ?? 0) * 5;
    return v;
  }, [
    project?.imageCount,
    project?.assets,
    project?.processingRuns.length,
    project?.previewRuns.length,
    status,
    previewStatus,
  ]);

  useMapAutoBounds(projectId, assetVersion);
  const activeLayer = useResultsViewStore((s) => s.activeLayer);
  const setActiveLayer = useResultsViewStore((s) => s.setActiveLayer);
  const opacity = useResultsViewStore((s) => s.opacity);
  const setOpacity = useResultsViewStore((s) => s.setOpacity);
  const showRealFlightPath = useResultsViewStore((s) => s.showRealFlightPath);
  const setShowRealFlightPath = useResultsViewStore(
    (s) => s.setShowRealFlightPath,
  );

  const sparseOnMap =
    sparseCloudAvailable || Boolean(project?.sparseCloudAvailable);

  useEffect(() => {
    if (activeLayer === "sparse" && !sparseOnMap) {
      setActiveLayer("orthophoto");
    }
  }, [activeLayer, sparseOnMap, setActiveLayer]);

  const currentBadge = useMemo(() => {
    if (status === "completed")
      return <Badge variant="success">Concluido</Badge>;
    if (status === "processing")
      return <Badge variant="processing">Processando</Badge>;
    if (status === "failed") return <Badge variant="error">Falhou</Badge>;
    return <Badge variant="uploading">Aguardando processamento</Badge>;
  }, [status]);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[1.2px] text-neutral-500">
          Camada ativa
        </p>
        <LayerSelector
          activeLayer={activeLayer}
          onChange={setActiveLayer}
          sparseLayerUnlocked={sparseOnMap}
          showRealFlightPath={showRealFlightPath}
          onRealFlightPathChange={setShowRealFlightPath}
        />
        {sparseOnMap && (
          <button
            type="button"
            onClick={() => setCloudViewerOpen(true)}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-[#3ecf8e] transition-colors hover:bg-[#3ecf8e]/5 hover:text-[#00c573]"
          >
            <Boxes className="size-3.5" />
            Visualizar nuvem esparsa em 3D
          </button>
        )}
        <p className="text-xs text-neutral-500">
          Com MDS, MDT ou curvas, use o controlo vertical no mapa. Em
          ortomosaico, a opacidade é por execução no bloco abaixo.
        </p>
        <MapRouteDeckVisibilityToggles
          scope="results"
          hint="No Mapbox 3D, a rota do plano de voo (se carregada) segue a altitude dos waypoints."
        />
        {activeLayer !== "orthophoto" ? (
          <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
            <label
              className="shrink-0 text-[11px] font-mono uppercase tracking-[1.2px] text-neutral-500"
              htmlFor="results-opacity-slider"
            >
              Opac.
            </label>
            <input
              id="results-opacity-slider"
              type="range"
              min={0}
              max={100}
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="min-w-0 flex-1"
              aria-label="Opacidade da camada ativa"
            />
            <span className="w-8 shrink-0 text-right font-mono text-[11px] text-neutral-400">
              {opacity}%
            </span>
          </div>
        ) : null}
      </div>

      {project ? <ResultRunLayersPanel project={project} /> : null}

      <Card className="space-y-2 border-[#2e2e2e] bg-[#171717]/80">
        <p className="text-sm text-neutral-400">Status do projeto</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-base text-neutral-100">
            {project?.name ?? "Projeto de mapeamento"}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            {currentBadge}
            {status === "completed" && !redoPanelOpen ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setRedoPanelOpen(true)}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refazer processamento
              </Button>
            ) : null}
          </div>
        </div>
      </Card>

      {status === "uploading" ||
      status === "failed" ||
      (status === "completed" && redoPanelOpen) ? (
        <StartProcessingPanel
          selectedPreset={preset}
          onSelectPreset={setPreset}
          isRetry={status === "failed"}
          isRedo={status === "completed" && redoPanelOpen}
          onDismiss={
            status === "completed" && redoPanelOpen
              ? () => setRedoPanelOpen(false)
              : undefined
          }
          onFinalizeStuck={status === "failed" ? finalizeStuckMain : undefined}
          enablePreview={enablePreview}
          onTogglePreview={setEnablePreview}
          onStart={() => void startProcessing(preset, enablePreview)}
        />
      ) : null}

      {status === "processing" ? (
        <ProcessingView
          progress={progress}
          message={message}
          eta={eta}
          logs={logs}
          onCancel={() => void cancelProcessing()}
          previewStatus={previewStatus}
          previewProgress={previewProgress}
          sparseCloudAvailable={sparseCloudAvailable}
          sparseCloudTrackProgress={sparseCloudTrackProgress}
          sparseCloudTrackHint={sparseCloudTrackHint}
          onFinalizeStuckMain={finalizeStuckMain}
          onFinalizeStuckPreview={
            previewStatus === "processing" ? finalizeStuckPreview : undefined
          }
        />
      ) : null}

      {status === "completed" && !redoPanelOpen ? (
        <>
          <ProcessingStatsGrid stats={extractCompletedStats(project?.stats)} />
          <DownloadPanel
            projectId={projectId}
            assets={project?.assets ?? null}
          />
          <PointCloudViewer />
        </>
      ) : null}

      <Card className="space-y-3 border-red-900/40 bg-red-950/10">
        <div>
          <p className="text-sm font-medium text-red-200/90">Zona de perigo</p>
          <p className="mt-1 text-xs text-neutral-500">
            Remover ficheiros e registos do servidor por categoria. Use quando
            precisar libertar espaco ou recomecar sem apagar o projeto inteiro.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full border-red-900/50 text-red-200 hover:border-red-700 hover:bg-red-950/40"
          onClick={() => setPurgeModalOpen(true)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Limpar dados do projeto…
        </Button>
      </Card>

      <ProjectPurgeModal
        open={purgeModalOpen}
        onOpenChange={setPurgeModalOpen}
        projectId={projectId}
        projectName={project?.name ?? "Projeto"}
      />
    </div>
  );
}
