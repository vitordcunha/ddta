import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cpu, ListOrdered, OctagonX, Server } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Badge, Button, Card, CardBody, CardHeader } from "@/components/ui";
import { WORKSPACE_ROOT } from "@/constants/routes";
import { processingQueueService } from "@/services/processingQueueService";
import { projectsService } from "@/services/projectsService";

function extractAxiosDetail(err: unknown): string {
  const res =
    typeof err === "object" && err !== null
      ? (err as { response?: { data?: { detail?: unknown } } }).response
      : undefined;
  const detail = res?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) =>
        typeof d === "object" && d && "msg" in d
          ? String((d as { msg: unknown }).msg)
          : String(d),
      )
      .join("; ");
  }
  return "";
}

function bucketBadgeVariant(
  bucket: string,
): "success" | "processing" | "created" {
  if (bucket === "active") return "success";
  if (bucket === "reserved") return "processing";
  return "created";
}

function odmCancelable(status: string): boolean {
  const s = status.toLowerCase();
  return ![
    "completed",
    "failed",
    "canceled",
    "cancelled",
    "unknown",
    "unavailable",
  ].includes(s);
}

export function ProcessingQueuePanel() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error, dataUpdatedAt, isFetching } =
    useQuery({
      queryKey: ["processing-queue"],
      queryFn: () => processingQueueService.getSnapshot(),
      refetchInterval: 5_000,
      staleTime: 4_000,
    });

  const invalidateQueue = () => {
    void queryClient.invalidateQueries({ queryKey: ["processing-queue"] });
    void queryClient.invalidateQueries({ queryKey: ["projects"] });
    void queryClient.invalidateQueries({ queryKey: ["project"] });
  };

  const revokeCeleryMutation = useMutation({
    mutationFn: (taskId: string) =>
      processingQueueService.revokeCeleryTask(taskId),
    onSuccess: () => {
      toast.success("Tarefa Celery revogada.");
      invalidateQueue();
    },
    onError: (err: unknown) => {
      const detail = extractAxiosDetail(err);
      toast.error(detail || "Nao foi possivel revogar a tarefa Celery.");
    },
  });

  const cancelOdmMutation = useMutation({
    mutationFn: (uuid: string) => processingQueueService.cancelOdmTask(uuid),
    onSuccess: () => {
      toast.success("Tarefa NodeODM cancelada.");
      invalidateQueue();
    },
    onError: (err: unknown) => {
      const detail = extractAxiosDetail(err);
      toast.error(detail || "Nao foi possivel cancelar no NodeODM.");
    },
  });

  const cancelProjectMutation = useMutation({
    mutationFn: (projectId: string) =>
      projectsService.cancelProcessing(projectId),
    onSuccess: () => {
      toast.success("Processamento do projecto cancelado.");
      invalidateQueue();
    },
    onError: (err: unknown) => {
      const detail = extractAxiosDetail(err);
      toast.error(detail || "Nao foi possivel cancelar o projecto.");
    },
  });

  const confirmRevokeCelery = (taskId: string) => {
    if (
      !window.confirm(
        `Revogar a tarefa Celery ${taskId.slice(0, 8)}…? O worker pode ser terminado (terminate) e o estado do projecto sera actualizado se estiver ligado.`,
      )
    ) {
      return;
    }
    revokeCeleryMutation.mutate(taskId);
  };

  const confirmCancelOdm = (uuid: string) => {
    if (
      !window.confirm(
        `Cancelar a tarefa NodeODM ${uuid.slice(0, 8)}… no nó ODM?`,
      )
    ) {
      return;
    }
    cancelOdmMutation.mutate(uuid);
  };

  const confirmCancelProject = (projectId: string, name: string) => {
    if (
      !window.confirm(
        `Cancelar todo o processamento (principal e preview) do projecto «${name}»?`,
      )
    ) {
      return;
    }
    cancelProjectMutation.mutate(projectId);
  };

  const updatedLabel =
    dataUpdatedAt > 0
      ? new Intl.DateTimeFormat("pt-PT", {
          timeStyle: "medium",
          dateStyle: "short",
        }).format(dataUpdatedAt)
      : "—";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
        {isFetching ? (
          <span className="text-[#3ecf8e]">A actualizar…</span>
        ) : (
          <span />
        )}
        <span>Ultima leitura: {updatedLabel}</span>
      </div>

      {isLoading ? (
        <p className="text-sm text-neutral-400">A carregar estado…</p>
      ) : null}
      {isError ? (
        <Card className="border-red-900/50 bg-red-950/20">
          <CardBody>
            <p className="text-sm text-red-200">
              Nao foi possivel obter o estado da fila. Verifique se a API esta
              acessivel.
            </p>
            <p className="mt-2 font-mono text-xs text-red-300/80">
              {error instanceof Error ? error.message : String(error)}
            </p>
          </CardBody>
        </Card>
      ) : null}

      {data ? (
        <div className="grid grid-cols-1 gap-4">
          <Card className="border-neutral-800 bg-[#141414]/90">
            <CardHeader className="flex flex-row items-center gap-2 border-b border-neutral-800/80 pb-3">
              <Cpu className="size-4 text-[#3ecf8e]" aria-hidden />
              <div>
                <h2 className="text-sm font-medium text-neutral-100">
                  Celery (workers)
                </h2>
                <p className="text-xs text-neutral-500">
                  Reservado = na fila do worker; activo = a correr.
                </p>
              </div>
            </CardHeader>
            <CardBody className="space-y-2 pt-3">
              <div className="flex flex-wrap items-center gap-2">
                {data.celery_workers_reached ? (
                  <Badge variant="success">Workers online</Badge>
                ) : (
                  <Badge variant="error">Sem resposta</Badge>
                )}
              </div>
              {data.celery_error ? (
                <p className="text-xs text-amber-200/90">{data.celery_error}</p>
              ) : null}
              {data.celery_tasks.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  Nenhuma tarefa activa, reservada ou agendada.
                </p>
              ) : (
                <ul className="max-h-[min(55vh,420px)] space-y-2 overflow-y-auto pr-1 text-sm">
                  {data.celery_tasks.map((t, i) => (
                    <li
                      key={`${t.task_id ?? i}-${t.worker}-${t.bucket}`}
                      className="rounded-md border border-neutral-800/80 bg-neutral-950/50 p-2.5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                          <Badge variant={bucketBadgeVariant(t.bucket)}>
                            {t.bucket}
                          </Badge>
                          <span className="font-mono text-[10px] text-neutral-500">
                            {t.worker}
                          </span>
                        </div>
                        {t.task_id ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="shrink-0 border-red-900/50 text-xs text-red-200 hover:bg-red-950/30"
                            disabled={revokeCeleryMutation.isPending}
                            onClick={() => confirmRevokeCelery(t.task_id!)}
                            title="Revogar esta tarefa no broker (terminate no worker)"
                          >
                            <OctagonX className="mr-1 size-3.5" aria-hidden />
                            Revogar
                          </Button>
                        ) : null}
                      </div>
                      {t.task_name ? (
                        <p className="mt-1 break-all font-mono text-xs text-neutral-300">
                          {t.task_name}
                        </p>
                      ) : null}
                      {t.task_id ? (
                        <p className="mt-0.5 font-mono text-[10px] text-neutral-500">
                          id: {t.task_id}
                        </p>
                      ) : null}
                      {t.args_preview ? (
                        <p className="mt-1 line-clamp-4 font-mono text-[10px] text-neutral-500">
                          {t.args_preview}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card className="border-neutral-800 bg-[#141414]/90">
            <CardHeader className="flex flex-row items-center gap-2 border-b border-neutral-800/80 pb-3">
              <ListOrdered className="size-4 text-[#3ecf8e]" aria-hidden />
              <div>
                <h2 className="text-sm font-medium text-neutral-100">
                  Projetos na pipeline
                </h2>
                <p className="text-xs text-neutral-500">
                  Estado na base (principal e preview).
                </p>
              </div>
            </CardHeader>
            <CardBody className="space-y-2 pt-3">
              {data.pipeline_projects.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  Nenhum projecto em fila ou processamento.
                </p>
              ) : (
                <ul className="max-h-[min(55vh,420px)] space-y-2 overflow-y-auto pr-1 text-sm">
                  {data.pipeline_projects.map((p) => {
                    const canCancelMain =
                      p.status === "queued" || p.status === "processing";
                    const canCancelPreviewOnly =
                      (p.preview_status === "queued" ||
                        p.preview_status === "processing") &&
                      Boolean(p.celery_preview_task_id) &&
                      !canCancelMain;
                    return (
                      <li
                        key={p.id}
                        className="rounded-md border border-neutral-800/80 bg-neutral-950/50 p-2.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium text-neutral-100">
                            {p.name}
                          </span>
                          <div className="flex shrink-0 flex-wrap items-center gap-2">
                            {canCancelMain ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="border-red-900/50 text-xs text-red-200 hover:bg-red-950/30"
                                disabled={cancelProjectMutation.isPending}
                                onClick={() =>
                                  confirmCancelProject(p.id, p.name)
                                }
                              >
                                Cancelar projecto
                              </Button>
                            ) : null}
                            {canCancelPreviewOnly &&
                            p.celery_preview_task_id ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="border-red-900/50 text-xs text-red-200 hover:bg-red-950/30"
                                disabled={revokeCeleryMutation.isPending}
                                onClick={() => {
                                  const id = p.celery_preview_task_id;
                                  if (id) confirmRevokeCelery(id);
                                }}
                              >
                                Cancelar preview
                              </Button>
                            ) : null}
                            <Link
                              to={`${WORKSPACE_ROOT}?panel=results&project=${encodeURIComponent(p.id)}`}
                              className="text-xs text-[#3ecf8e] hover:underline"
                            >
                              Resultados
                            </Link>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge variant="created">
                            main: {p.status} {p.progress}%
                          </Badge>
                          {p.preview_status ? (
                            <Badge variant="info">
                              preview: {p.preview_status} {p.preview_progress}%
                            </Badge>
                          ) : null}
                        </div>
                        <dl className="mt-2 space-y-1 font-mono text-[10px] text-neutral-500">
                          {p.celery_main_task_id ? (
                            <div>
                              <dt className="inline text-neutral-600">
                                celery main{" "}
                              </dt>
                              <dd className="inline break-all">
                                {p.celery_main_task_id}
                              </dd>
                            </div>
                          ) : null}
                          {p.celery_preview_task_id ? (
                            <div>
                              <dt className="inline text-neutral-600">
                                celery preview{" "}
                              </dt>
                              <dd className="inline break-all">
                                {p.celery_preview_task_id}
                              </dd>
                            </div>
                          ) : null}
                          {p.odm_main_task_id ? (
                            <div>
                              <dt className="inline text-neutral-600">
                                odm main{" "}
                              </dt>
                              <dd className="inline break-all">
                                {p.odm_main_task_id}
                              </dd>
                            </div>
                          ) : null}
                          {p.odm_preview_task_id ? (
                            <div>
                              <dt className="inline text-neutral-600">
                                odm preview{" "}
                              </dt>
                              <dd className="inline break-all">
                                {p.odm_preview_task_id}
                              </dd>
                            </div>
                          ) : null}
                        </dl>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card className="border-neutral-800 bg-[#141414]/90">
            <CardHeader className="flex flex-row items-center gap-2 border-b border-neutral-800/80 pb-3">
              <Server className="size-4 text-[#3ecf8e]" aria-hidden />
              <div>
                <h2 className="text-sm font-medium text-neutral-100">
                  NodeODM
                </h2>
                <p className="text-xs text-neutral-500">
                  {data.odm_host}:{data.odm_port} — tarefas reportadas pelo nó.
                </p>
              </div>
            </CardHeader>
            <CardBody className="space-y-2 pt-3">
              <div className="flex flex-wrap items-center gap-2">
                {data.odm_node_reachable ? (
                  <Badge variant="success">Node ODM acessivel</Badge>
                ) : (
                  <Badge variant="error">Node ODM inacessivel</Badge>
                )}
              </div>
              {data.odm_error ? (
                <p className="text-xs text-amber-200/90">{data.odm_error}</p>
              ) : null}
              {data.odm_tasks.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  Lista de tarefas vazia ou nao disponivel.
                </p>
              ) : (
                <ul className="max-h-[min(55vh,420px)] space-y-2 overflow-y-auto pr-1 text-sm">
                  {data.odm_tasks.map((t) => (
                    <li
                      key={t.uuid}
                      className="rounded-md border border-neutral-800/80 bg-neutral-950/50 p-2.5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant={
                              t.status === "processing"
                                ? "processing"
                                : "created"
                            }
                          >
                            {t.status}
                          </Badge>
                          <span className="text-xs text-neutral-400">
                            {Math.round(t.progress)}%
                          </span>
                        </div>
                        {odmCancelable(t.status) ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="shrink-0 border-red-900/50 text-xs text-red-200 hover:bg-red-950/30"
                            disabled={cancelOdmMutation.isPending}
                            onClick={() => confirmCancelOdm(t.uuid)}
                          >
                            <OctagonX className="mr-1 size-3.5" aria-hidden />
                            Cancelar
                          </Button>
                        ) : null}
                      </div>
                      <p className="mt-1 break-all font-mono text-[10px] text-neutral-400">
                        {t.uuid}
                      </p>
                      {t.linked_project_id ? (
                        <p className="mt-1 text-xs text-neutral-300">
                          Projecto:{" "}
                          <Link
                            to={`${WORKSPACE_ROOT}?panel=results&project=${encodeURIComponent(t.linked_project_id)}`}
                            className="text-[#3ecf8e] hover:underline"
                          >
                            {t.linked_project_id.slice(0, 8)}…
                          </Link>
                          {t.pipeline ? (
                            <span className="text-neutral-500">
                              {" "}
                              ({t.pipeline})
                            </span>
                          ) : null}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-neutral-600">
                          Sem correspondencia na base local.
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      ) : null}

      <p className="text-center text-[11px] text-neutral-600">
        Actualizacao automatica a cada 5 s. Revogar Celery usa terminate no
        worker; cancelar NodeODM pede ao nó para parar a tarefa e revoga Celery
        ligado na base, quando aplicável.
      </p>
    </div>
  );
}
