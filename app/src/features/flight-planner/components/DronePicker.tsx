import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, ChevronRight, Loader2, Plus } from "lucide-react";
import { DialogPanel } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { FlightParams } from "@/features/flight-planner/types";
import type { ApiDroneModel } from "@/features/flight-planner/types/droneModelApi";
import { DroneIllustration } from "@/features/flight-planner/components/DroneIllustration";
import { getDroneOptions, getDroneSpec } from "@/features/flight-planner/utils/droneSpecs";
import {
  flightProfileFromApiModel,
  profileToDroneSpec,
} from "@/features/flight-planner/utils/flightDroneProfile";

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
    <DialogPanel
      open={open}
      onOpenChange={onOpenChange}
      title="Selecionar drone"
      preventInitialFocus
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
    </DialogPanel>
  );
}
