import * as Dialog from "@radix-ui/react-dialog";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, ChevronRight, Loader2, Plus, X } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import type { FlightParams } from "@/features/flight-planner/types";
import type { ApiDroneModel } from "@/features/flight-planner/types/droneModelApi";
import { DroneIllustration } from "@/features/flight-planner/components/DroneIllustration";
import { getDroneOptions, getDroneSpec } from "@/features/flight-planner/utils/droneSpecs";
import {
  flightProfileFromApiModel,
  profileToDroneSpec,
} from "@/features/flight-planner/utils/flightDroneProfile";

const DESKTOP = "(min-width: 1024px)";

type DronePickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  params: FlightParams;
  setParams: (patch: Partial<FlightParams>) => void;
  models: ApiDroneModel[] | undefined;
  isLoading: boolean;
  isError: boolean;
};

function mpFromPx(w: number, h: number) {
  return ((w * h) / 1_000_000).toFixed(0);
}

/** Mescla specs da API com imagem da tabela local quando existir. */
function displaySpecForApiModel(m: ApiDroneModel) {
  const base = profileToDroneSpec(flightProfileFromApiModel(m));
  const leg = getDroneSpec(m.name);
  return { ...base, ...(leg.image ? { image: leg.image } : {}) };
}

function DroneThumb({
  modelName,
  imageSrc,
  className,
}: {
  modelName: string;
  imageSrc?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex size-[4.5rem] shrink-0 items-center justify-center rounded-xl bg-white/[0.06] ring-1 ring-white/[0.1]",
        className,
      )}
    >
      {imageSrc ? (
        <img
          src={imageSrc}
          alt=""
          className="size-full object-contain p-1"
        />
      ) : (
        <DroneIllustration model={modelName} size={72} className="opacity-95" />
      )}
    </div>
  );
}

export function DronePicker({
  open,
  onOpenChange,
  params,
  setParams,
  models,
  isLoading,
  isError,
}: DronePickerProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isDesktop = useMediaQuery(DESKTOP);
  const useApiList = !isError && models && models.length > 0;
  const defaults = useApiList ? models!.filter((m) => !m.is_custom) : [];
  const customs = useApiList ? models!.filter((m) => m.is_custom) : [];

  const goManageFleet = () => {
    const next = new URLSearchParams(searchParams);
    next.set("panel", "settings");
    navigate({ pathname: "/", search: next.toString(), hash: "fleet-drones" });
    onOpenChange(false);
  };

  const selectApi = (m: ApiDroneModel) => {
    setParams({ droneModelId: m.id, droneModel: m.name });
    onOpenChange(false);
  };

  const selectLegacy = (name: string) => {
    setParams({ droneModelId: null, droneModel: name });
    onOpenChange(false);
  };

  const isApiSelected = (m: ApiDroneModel) => params.droneModelId === m.id;
  const isLegacySelected = (name: string) =>
    !params.droneModelId && params.droneModel === name;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[140] bg-black/55 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className={cn(
            "fixed z-[141] flex max-h-[min(90dvh,640px)] flex-col border border-white/[0.12] bg-[#141414] shadow-2xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            isDesktop
              ? "left-1/2 top-1/2 w-[min(92vw,28rem)] max-h-[min(85vh,560px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl duration-200 zoom-in-95 data-[state=closed]:zoom-out-95"
              : "inset-x-0 bottom-0 max-h-[min(88dvh,720px)] rounded-t-2xl duration-300 slide-in-from-bottom-4 data-[state=closed]:slide-out-to-bottom-4",
          )}
          style={{
            paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))",
          }}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-3 pr-3">
            <Dialog.Title className="text-base font-semibold tracking-tight text-neutral-100">
              Selecionar drone
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Fechar"
                className="flex size-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-neutral-400 transition-colors hover:bg-white/[0.06] hover:text-neutral-100"
              >
                <X className="size-5" aria-hidden />
              </button>
            </Dialog.Close>
          </div>

          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {useApiList && isLoading ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-neutral-500">
                <Loader2 className="size-8 animate-spin text-primary-400/80" />
                Carregando catálogo…
              </div>
            ) : useApiList ? (
              <div className="space-y-6">
                <section className="space-y-2">
                  <h3 className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                    Modelos padrão
                  </h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {defaults.map((m) => {
                      const spec = displaySpecForApiModel(m);
                      const selected = isApiSelected(m);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => selectApi(m)}
                          className={cn(
                            "flex min-h-[5rem] min-w-0 flex-col items-center gap-2 rounded-xl border p-3 text-center transition-colors",
                            selected
                              ? "border-emerald-500/70 bg-emerald-500/[0.08] ring-1 ring-emerald-500/40"
                              : "border-white/[0.1] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]",
                          )}
                        >
                          <div className="relative">
                            <DroneThumb
                              modelName={m.name}
                              imageSrc={spec.image}
                            />
                            {selected ? (
                              <span className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-emerald-500 text-neutral-950 shadow">
                                <Check className="size-3.5" strokeWidth={2.5} />
                              </span>
                            ) : null}
                          </div>
                          <span className="line-clamp-2 w-full text-xs font-medium leading-tight text-neutral-100">
                            {m.name}
                          </span>
                          <span className="line-clamp-2 w-full text-[10px] leading-snug text-neutral-500">
                            {spec.batteryTimeMin} min · {mpFromPx(spec.imageWidthPx, spec.imageHeightPx)} MP ·{" "}
                            {spec.focalLengthMm} mm
                          </span>
                          {selected ? (
                            <span className="text-[10px] font-medium text-emerald-400/95">
                              Selecionado
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="space-y-2">
                  <h3 className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                    Meus modelos
                  </h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={goManageFleet}
                      className="flex min-h-[5rem] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/[0.02] p-3 text-center transition-colors hover:border-primary-400/50 hover:bg-white/[0.05]"
                    >
                      <span className="flex size-12 items-center justify-center rounded-xl bg-white/[0.06] ring-1 ring-white/10">
                        <Plus className="size-6 text-primary-300/90" />
                      </span>
                      <span className="text-xs font-medium text-neutral-200">
                        Adicionar
                      </span>
                    </button>
                    {customs.map((m) => {
                      const spec = displaySpecForApiModel(m);
                      const selected = isApiSelected(m);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => selectApi(m)}
                          className={cn(
                            "flex min-h-[5rem] min-w-0 flex-col items-center gap-2 rounded-xl border p-3 text-center transition-colors",
                            selected
                              ? "border-emerald-500/70 bg-emerald-500/[0.08] ring-1 ring-emerald-500/40"
                              : "border-white/[0.1] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]",
                          )}
                        >
                          <div className="relative">
                            <DroneThumb modelName={m.name} imageSrc={spec.image} />
                            {selected ? (
                              <span className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-emerald-500 text-neutral-950 shadow">
                                <Check className="size-3.5" strokeWidth={2.5} />
                              </span>
                            ) : null}
                          </div>
                          <span className="line-clamp-2 w-full text-xs font-medium text-neutral-100">
                            {m.name}
                          </span>
                          <span className="line-clamp-2 w-full text-[10px] text-neutral-500">
                            {spec.batteryTimeMin} min · {mpFromPx(spec.imageWidthPx, spec.imageHeightPx)} MP ·{" "}
                            {spec.focalLengthMm} mm
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <button
                  type="button"
                  onClick={goManageFleet}
                  className="flex w-full min-h-12 items-center justify-center gap-1 rounded-xl border border-white/[0.1] bg-white/[0.03] py-3 text-sm font-medium text-primary-300/95 transition-colors hover:bg-white/[0.06]"
                >
                  Gerenciar frota
                  <ChevronRight className="size-4 opacity-80" aria-hidden />
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {isError ? (
                  <p className="rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 text-[11px] text-amber-200/90">
                    Catálogo indisponível — escolha um modelo da lista local abaixo.
                  </p>
                ) : null}
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                  Modelos (offline)
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {getDroneOptions().map((opt) => {
                    const spec = getDroneSpec(opt.value);
                    const selected = isLegacySelected(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => selectLegacy(opt.value)}
                        className={cn(
                          "flex min-h-[5rem] min-w-0 flex-col items-center gap-2 rounded-xl border p-3 text-center transition-colors",
                          selected
                            ? "border-emerald-500/70 bg-emerald-500/[0.08] ring-1 ring-emerald-500/40"
                            : "border-white/[0.1] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]",
                        )}
                      >
                        <div className="relative">
                          <DroneThumb
                            modelName={opt.value}
                            imageSrc={spec.image}
                          />
                          {selected ? (
                            <span className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-emerald-500 text-neutral-950 shadow">
                              <Check className="size-3.5" strokeWidth={2.5} />
                            </span>
                          ) : null}
                        </div>
                        <span className="text-xs font-medium text-neutral-100">
                          {opt.label}
                        </span>
                        <span className="line-clamp-2 w-full text-[10px] text-neutral-500">
                          {spec.batteryTimeMin} min · {mpFromPx(spec.imageWidthPx, spec.imageHeightPx)} MP ·{" "}
                          {spec.focalLengthMm} mm
                        </span>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={goManageFleet}
                  className="flex w-full min-h-12 items-center justify-center gap-1 rounded-xl border border-white/[0.1] bg-white/[0.03] py-3 text-sm font-medium text-primary-300/95 transition-colors hover:bg-white/[0.06]"
                >
                  Gerenciar frota na Config
                  <ChevronRight className="size-4 opacity-80" aria-hidden />
                </button>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
