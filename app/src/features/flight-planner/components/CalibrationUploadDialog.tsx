import * as Dialog from "@radix-ui/react-dialog";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import type { Feature, Polygon } from "geojson";
import { ImageUp, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { CalibrationGridMap } from "@/features/flight-planner/components/CalibrationGridMap";
import { CalibrationSlotInspector } from "@/features/flight-planner/components/CalibrationSlotInspector";
import type { PlannerBaseLayerId } from "@/features/flight-planner/constants/mapBaseLayers";
import { useCalibrationSession } from "@/features/flight-planner/hooks/useCalibrationSession";
import {
  projectsService,
  type CalibrationExifMetric,
  type CalibrationImageSummary,
} from "@/services/projectsService";

const MIN_FILES = 5;
const MAX_FILES = 30;

function severityStyles(s: CalibrationExifMetric["severity"]) {
  switch (s) {
    case "ok":
      return "border-emerald-500/35 bg-emerald-500/10 text-emerald-100/95";
    case "warn":
      return "border-amber-500/35 bg-amber-500/10 text-amber-100/95";
    case "bad":
      return "border-red-500/40 bg-red-500/10 text-red-100/95";
    case "info":
      return "border-sky-500/30 bg-sky-500/10 text-sky-100/90";
    default:
      return "border-white/10 bg-black/25 text-neutral-300";
  }
}

export type CalibrationUploadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string | null;
  onUploaded?: () => void;
  /** Polígono da missão de calibração (mesmo da sessão) para desenhar a grade. */
  calibrationPolygon?: Feature<Polygon> | null;
  plannerBaseLayerId?: PlannerBaseLayerId;
};

export function CalibrationUploadDialog({
  open,
  onOpenChange,
  sessionId,
  onUploaded,
  calibrationPolygon,
  plannerBaseLayerId = "satellite",
}: CalibrationUploadDialogProps) {
  const titleId = useId();
  const descId = useId();
  const [revision, setRevision] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const [consent, setConsent] = useState(false);
  const [storeOriginal, setStoreOriginal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [sessionImages, setSessionImages] = useState<CalibrationImageSummary[]>(
    [],
  );
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [showPhotoFootprints, setShowPhotoFootprints] = useState(false);

  const { session, loading, error, analysisTimedOut, refetch } = useCalibrationSession(
    sessionId,
    open && !!sessionId,
    revision,
  );

  useEffect(() => {
    if (!open || !sessionId) {
      setSessionImages([]);
      return;
    }
    void projectsService
      .listCalibrationSessionImages(sessionId)
      .then(setSessionImages)
      .catch(() => setSessionImages([]));
  }, [open, sessionId, session?.updated_at, session?.status, revision]);

  const exifMetrics = session?.exif_report?.metrics ?? [];
  const pixelMetrics = session?.pixel_report?.metrics ?? [];
  const reportError =
    session?.exif_report?.error ?? session?.pixel_report?.error;
  const gridSlots = session?.theoretical_grid?.slots ?? [];
  const slotCounts = session?.exif_report?.calibration_grid?.slot_counts;
  const slotReportsById = useMemo(() => {
    const list = session?.pixel_report?.slot_reports ?? [];
    const m: Record<string, (typeof list)[0]> = {};
    for (const r of list) {
      if (r.slot_id) m[r.slot_id] = r;
    }
    return m;
  }, [session?.pixel_report?.slot_reports]);

  const photoFootprints = useMemo(() => {
    return sessionImages
      .map((im) => {
        const poly = im.extras?.footprint_polygon as Polygon | undefined;
        if (!poly || poly.type !== "Polygon" || !poly.coordinates?.[0]?.length)
          return null;
        const ring = poly.coordinates[0].map(
          ([lng, lat]) => [lat, lng] as [number, number],
        );
        return { imageId: im.id, ring };
      })
      .filter(Boolean) as { imageId: string; ring: [number, number][] }[];
  }, [sessionImages]);

  const selectedSlot = useMemo(
    () => gridSlots.find((s) => s.id === selectedSlotId) ?? null,
    [gridSlots, selectedSlotId],
  );

  const resetForm = useCallback(() => {
    setFiles([]);
    setConsent(false);
    setStoreOriginal(false);
    setLocalError(null);
  }, []);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    const list = Array.from(e.dataTransfer.files).filter(
      (f) => f.type === "image/jpeg",
    );
    setFiles((prev) => mergeJpegs(prev, list));
  };

  const onFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files ? Array.from(e.target.files) : [];
    setFiles((prev) =>
      mergeJpegs(
        prev,
        list.filter((f) => f.type === "image/jpeg"),
      ),
    );
    e.target.value = "";
  };

  const submit = async () => {
    setLocalError(null);
    if (!sessionId) {
      setLocalError(
        "Selecione uma sessão de calibração no painel (botão «Usar no planejador»).",
      );
      return;
    }
    if (!consent) {
      setLocalError(
        "Marque o consentimento para processar os metadados (LGPD/GDPR).",
      );
      return;
    }
    if (files.length < MIN_FILES || files.length > MAX_FILES) {
      setLocalError(`Envie entre ${MIN_FILES} e ${MAX_FILES} arquivos JPEG.`);
      return;
    }
    setBusy(true);
    try {
      await projectsService.uploadCalibrationImages(sessionId, files, {
        consentProcessPersonalData: true,
        storeOriginal,
      });
      resetForm();
      setRevision((r) => r + 1);
      await refetch();
      onUploaded?.();
    } catch {
      setLocalError(
        "Falha no envio. Verifique o tamanho dos JPEGs e tente de novo.",
      );
    } finally {
      setBusy(false);
    }
  };

  const blocking = busy || loading;

  const statusLabel = useMemo(() => {
    const s = session?.status;
    if (s === "analyzing" && analysisTimedOut)
      return "Análise demorando mais que o esperado — verifique se o servidor (Celery/Redis) está rodando.";
    if (s === "analyzing") return "A analisar EXIF e píxeis (miniaturas)…";
    if (s === "ready") return "Relatório EXIF e de píxeis pronto.";
    if (s === "failed") return "A análise falhou.";
    return "Aguardando envio ou sessão.";
  }, [session?.status, analysisTimedOut]);

  // Cobertura de slots: quantos slots foram cobertos pelas fotos enviadas
  const slotCoverageInfo = useMemo(() => {
    if (session?.status !== "ready" || !slotCounts) return null;
    const total = gridSlots.length;
    if (total === 0) return null;
    const covered = (slotCounts["covered"] ?? 0) + (slotCounts["best"] ?? 0);
    const ratio = covered / total;
    return { covered, total, ratio };
  }, [session?.status, slotCounts, gridSlots.length]);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) resetForm();
        onOpenChange(o);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-[210] bg-black/60 backdrop-blur-sm"
          onClick={() => onOpenChange(false)}
        />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[211] flex max-h-[min(92vh,720px)] w-[94vw] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-neutral-800 bg-neutral-900 shadow-xl outline-none"
          aria-labelledby={titleId}
          aria-describedby={descId}
        >
          <div className="flex items-start justify-between gap-3 border-b border-white/10 p-4">
            <div>
              <Dialog.Title
                id={titleId}
                className="text-base font-medium text-neutral-100"
              >
                Upload — voo de calibração
              </Dialog.Title>
              <p
                id={descId}
                className="mt-1 text-xs leading-snug text-neutral-500"
              >
                Envie {MIN_FILES}–{MAX_FILES} JPEGs. São extraídos EXIF e
                geradas miniaturas (~
                {1280}px) para métricas de qualidade de imagem (histograma,
                nitidez, ORB, etc.).
              </p>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-950 hover:text-neutral-100"
                aria-label="Fechar"
              >
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {sessionId ? (
              <p className="font-mono text-[10px] text-neutral-500">
                Sessão: <span className="text-neutral-400">{sessionId}</span>
              </p>
            ) : (
              <p className="text-xs text-amber-200/90">
                Nenhuma sessão ativa. Crie uma pelo modal «Antes de voar» ou use
                «Usar no planejador» na lista.
              </p>
            )}

            <div
              className={cn(
                "flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-white/15 bg-black/20 p-4 text-center text-xs text-neutral-400 transition hover:border-primary-500/40",
                blocking && "pointer-events-none opacity-60",
              )}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
            >
              <ImageUp className="mb-2 size-8 text-neutral-500" aria-hidden />
              <p>Solte JPEGs aqui ou escolha ficheiros.</p>
              <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-primary-300">
                <input
                  type="file"
                  accept="image/jpeg"
                  multiple
                  className="sr-only"
                  onChange={onFileInput}
                />
                <span className="underline">Procurar…</span>
              </label>
              <p className="mt-2 font-mono text-[11px] text-neutral-500">
                {files.length} ficheiro{files.length === 1 ? "" : "s"}{" "}
                selecionado{files.length === 1 ? "" : "s"}
              </p>
            </div>

            <label className="flex cursor-pointer items-start gap-2 text-xs text-neutral-400">
              <input
                type="checkbox"
                className="mt-0.5 h-3.5 w-3.5 rounded border border-neutral-600"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>
                Consinto o tratamento dos{" "}
                <strong className="font-medium text-neutral-300">
                  metadados EXIF
                </strong>{" "}
                e de{" "}
                <strong className="font-medium text-neutral-300">
                  miniaturas JPEG
                </strong>{" "}
                (lado máx. ~1280px) derivadas no servidor apenas para análise de
                qualidade de imagem (base legal: execução do serviço
                solicitado).
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-2 text-xs text-neutral-400">
              <input
                type="checkbox"
                className="mt-0.5 h-3.5 w-3.5 rounded border border-neutral-600"
                checked={storeOriginal}
                onChange={(e) => setStoreOriginal(e.target.checked)}
              />
              <span>
                <strong className="font-medium text-neutral-300">
                  Guardar cópias em resolução completa
                </strong>{" "}
                no servidor (opcional). As miniaturas para análise de píxeis são
                sempre criadas após o consentimento acima; sem esta opção não
                guardamos o JPEG original.
              </span>
            </label>

            {(localError || error) && (
              <p className="text-xs text-red-300/95">{localError ?? error}</p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={blocking || !sessionId}
                onClick={() => void submit()}
              >
                {busy ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-3.5 animate-spin" />A enviar…
                  </span>
                ) : (
                  "Enviar e analisar"
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={blocking}
                onClick={() => void refetch()}
              >
                Atualizar estado
              </Button>
            </div>

            {calibrationPolygon && gridSlots.length > 0 ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                    Grade de slots
                  </p>
                  {photoFootprints.length > 0 ? (
                    <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-neutral-400">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border border-neutral-600"
                        checked={showPhotoFootprints}
                        onChange={(e) =>
                          setShowPhotoFootprints(e.target.checked)
                        }
                      />
                      Footprints por foto (aprox.)
                    </label>
                  ) : null}
                </div>
                <div className="flex flex-col gap-3 md:flex-row">
                  <div className="min-w-0 flex-1">
                    <CalibrationGridMap
                      baseLayerId={plannerBaseLayerId}
                      calibrationPolygon={calibrationPolygon}
                      slots={gridSlots}
                      heightClass="h-52 md:h-56"
                      onSlotClick={(id) =>
                        setSelectedSlotId((prev) => (prev === id ? null : id))
                      }
                      highlightSlotId={selectedSlotId}
                      slotReportsById={slotReportsById}
                      photoFootprints={photoFootprints}
                      showPhotoFootprints={showPhotoFootprints}
                    />
                  </div>
                  {sessionId && selectedSlot ? (
                    <div className="w-full shrink-0 md:w-56">
                      <CalibrationSlotInspector
                        sessionId={sessionId}
                        slot={selectedSlot}
                        slotReport={slotReportsById[selectedSlot.id]}
                        images={sessionImages}
                        onClose={() => setSelectedSlotId(null)}
                      />
                    </div>
                  ) : null}
                </div>
                {slotCounts && typeof slotCounts.total === "number" ? (
                  <p className="text-[11px] text-neutral-500">
                    Cobertos: {slotCounts.covered ?? 0} · Lacunas:{" "}
                    {slotCounts.gap ?? 0} · Avisos: {slotCounts.warning ?? 0} ·
                    Total: {slotCounts.total}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs">
              <p
                className={cn(
                  "font-medium",
                  analysisTimedOut && session?.status === "analyzing"
                    ? "text-amber-300"
                    : "text-neutral-200",
                )}
              >
                {analysisTimedOut && session?.status === "analyzing" ? "⏱ " : ""}
                {statusLabel}
              </p>
              {session?.status === "failed" && reportError ? (
                <p className="mt-2 text-red-300/90">{reportError}</p>
              ) : null}
              {slotCoverageInfo && slotCoverageInfo.ratio < 0.5 ? (
                <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-500/25 bg-amber-500/10 px-2.5 py-2 text-[11px] leading-snug text-amber-200/90">
                  <span className="mt-0.5 shrink-0">⚠</span>
                  <span>
                    Apenas{" "}
                    <strong>
                      {slotCoverageInfo.covered}/{slotCoverageInfo.total} slots
                    </strong>{" "}
                    cobertos ({Math.round(slotCoverageInfo.ratio * 100)}%).
                    Considere repetir o voo de calibração com mais fotos para
                    cobertura representativa.
                  </span>
                </div>
              ) : slotCoverageInfo ? (
                <p className="mt-1 text-[10px] text-emerald-400/80">
                  Cobertura: {slotCoverageInfo.covered}/{slotCoverageInfo.total}{" "}
                  slots ({Math.round(slotCoverageInfo.ratio * 100)}%)
                </p>
              ) : null}
              {exifMetrics.length > 0 ? (
                <>
                  <p className="mt-3 text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                    EXIF
                  </p>
                  <ul className="mt-1 space-y-2">
                    {exifMetrics.map((m) => (
                      <li
                        key={`exif-${m.id}-${m.title}`}
                        className={cn(
                          "rounded-md border p-2.5 text-[11px] leading-snug",
                          severityStyles(m.severity),
                        )}
                      >
                        <span className="font-medium">{m.title}</span>
                        <span className="mt-1 block opacity-95">
                          {m.detail}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {pixelMetrics.length > 0 ? (
                <>
                  <p className="mt-3 text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                    Píxeis
                  </p>
                  <ul className="mt-1 space-y-2">
                    {pixelMetrics.map((m) => (
                      <li
                        key={`px-${m.id}-${m.title}`}
                        className={cn(
                          "rounded-md border p-2.5 text-[11px] leading-snug",
                          severityStyles(m.severity),
                        )}
                      >
                        <span className="font-medium">{m.title}</span>
                        <span className="mt-1 block opacity-95">
                          {m.detail}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {session?.status === "ready" &&
              exifMetrics.length === 0 &&
              pixelMetrics.length === 0 ? (
                <p className="mt-2 text-neutral-500">
                  Sem métricas no relatório.
                </p>
              ) : null}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function mergeJpegs(prev: File[], next: File[]): File[] {
  const byKey = new Map<string, File>();
  const key = (f: File) => `${f.name}-${f.size}-${f.lastModified}`;
  for (const f of prev) byKey.set(key(f), f);
  for (const f of next) byKey.set(key(f), f);
  const merged = Array.from(byKey.values());
  return merged.slice(0, MAX_FILES);
}
