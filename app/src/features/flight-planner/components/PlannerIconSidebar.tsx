import { AnimatePresence, motion } from "framer-motion";
import {
  Crosshair,
  Hand,
  Lock,
  Map as MapIcon,
  Pencil,
  Pentagon,
  Trash2,
  Undo2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { WeatherLayerMapControls } from "@/components/map/WeatherLayerMapControls";
import { useFlightStore } from "@/features/flight-planner/stores/useFlightStore";
import {
  PLANNER_BASE_LAYER_IDS,
  getPlannerBaseLayerConfig,
} from "@/features/flight-planner/constants/mapBaseLayers";
import { useFlightPlannerMapHotkeys } from "@/features/flight-planner/hooks/useFlightPlannerMapHotkeys";
import { closeDraftToPolygon } from "@/features/flight-planner/utils/polygonDraft";
import type { WeatherMapOverlayPreferences } from "@/components/map/weather/mapWeatherTypes";
import type { RadarOverlayStatus } from "@/components/map/PlannerWeatherMapLayers";
import { useMapEngine } from "@/features/map-engine";
import type { MapProvider } from "@/features/map-engine/types";

interface PlannerIconSidebarProps {
  overlay: WeatherMapOverlayPreferences;
  setOverlay: (
    next:
      | WeatherMapOverlayPreferences
      | ((prev: WeatherMapOverlayPreferences) => WeatherMapOverlayPreferences),
  ) => void;
  openWeatherApiKey: string;
  radarStatus: RadarOverlayStatus;
  radarMessage?: string;
}

export function PlannerIconSidebar({
  overlay,
  setOverlay,
  openWeatherApiKey,
  radarStatus,
  radarMessage,
}: PlannerIconSidebarProps) {
  useFlightPlannerMapHotkeys();

  const [mapStyleOpen, setMapStyleOpen] = useState(false);
  const mapStyleRef = useRef<HTMLDivElement>(null);

  const mode = useFlightStore((s) => s.plannerInteractionMode);
  const setMode = useFlightStore((s) => s.setPlannerInteractionMode);
  const baseLayer = useFlightStore((s) => s.plannerBaseLayer);
  const setBaseLayer = useFlightStore((s) => s.setPlannerBaseLayer);
  const draftPoints = useFlightStore((s) => s.draftPoints);
  const setDraftPoints = useFlightStore((s) => s.setDraftPoints);
  const popLastDraftPoint = useFlightStore((s) => s.popLastDraftPoint);
  const setPolygon = useFlightStore((s) => s.setPolygon);
  const polygon = useFlightStore((s) => s.polygon);
  const poi = useFlightStore((s) => s.poi);
  const poiPlacementActive = useFlightStore((s) => s.poiPlacementActive);
  const setPoiPlacementActive = useFlightStore((s) => s.setPoiPlacementActive);
  const setPoi = useFlightStore((s) => s.setPoi);

  const hasDraft = draftPoints.length > 0;
  const canClose = draftPoints.length >= 3;
  const hasPolygon = Boolean(polygon);
  const showDrawActions = hasDraft || hasPolygon;

  const {
    provider: mapProvider,
    mode: mapViewMode,
    setProvider,
    setMode: setMapViewMode,
    deviceTier,
  } = useMapEngine();
  const map3dHint =
    deviceTier === "low" || deviceTier === "none"
      ? "Seu dispositivo pode não suportar visualização 3D com performance adequada."
      : undefined;

  const onClose = () => {
    if (!canClose) return;
    const closed = closeDraftToPolygon(draftPoints);
    if (!closed) return;
    setPolygon(closed);
    setDraftPoints([]);
  };

  const onClear = () => {
    setDraftPoints([]);
    setPolygon(null);
  };

  // Close popovers on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        mapStyleRef.current &&
        !mapStyleRef.current.contains(e.target as Node)
      ) {
        setMapStyleOpen(false);
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMapStyleOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, []);

  return (
    <div className="pointer-events-auto flex h-full min-h-0 w-min min-w-0 flex-1 flex-col items-stretch">
      {/*
        O painel "Estilo do mapa" usa position absolute para a direita. Não pode ficar
        dentro de um ancestor com overflow que não seja visible — senão o menu é recortado
        e a sidebar vira só scroll. Ferramentas fixas em cima; a parte de baixo rola.
      */}
      <div className="shrink-0 overflow-visible">
        <SidebarGroup aria-label="Ferramentas do mapa">
          <SidebarButton
            icon={Hand}
            label="Navegar (N)"
            active={mode === "navigate"}
            onClick={() => setMode("navigate")}
          />
          <div className="mx-2 h-px bg-white/[0.07]" />
          <SidebarButton
            icon={Pencil}
            label="Desenhar (D)"
            active={mode === "draw"}
            activeColor="green"
            onClick={() => setMode("draw")}
          />
          <div className="mx-2 h-px bg-white/[0.07]" />

          <div ref={mapStyleRef} className="relative z-[60]">
            <SidebarButton
              icon={MapIcon}
              label="Estilo do mapa"
              active={mapStyleOpen}
              onClick={() => setMapStyleOpen((o) => !o)}
            />
            <AnimatePresence>
              {mapStyleOpen && (
                <motion.div
                  initial={{ opacity: 0, x: -6, scale: 0.97 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -6, scale: 0.97 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="absolute left-full top-0 z-[60] ml-2 w-52 rounded-2xl border border-white/10 bg-[#0f0f0f]/95 p-3 shadow-2xl backdrop-blur-xl"
                >
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                    Estilo do mapa
                  </p>
                  <div className="flex flex-col gap-1">
                    {PLANNER_BASE_LAYER_IDS.map((id) => {
                      const sel = baseLayer === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            setBaseLayer(id);
                            setMapStyleOpen(false);
                          }}
                          className={cn(
                            "w-full rounded-lg border px-3 py-2 text-left text-xs font-medium transition",
                            sel
                              ? "border-primary-500/40 bg-primary-500/12 text-white"
                              : "border-white/10 bg-white/[0.04] text-neutral-300 hover:bg-white/[0.08] hover:text-white",
                          )}
                        >
                          {getPlannerBaseLayerConfig(id).label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mb-2 mt-3 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                    Provedor
                  </p>
                  <div className="flex flex-col gap-1">
                    {(
                      [
                        { id: "leaflet" as const, label: "Leaflet" },
                        { id: "mapbox" as const, label: "Mapbox" },
                        { id: "google" as const, label: "Google Maps" },
                      ] satisfies { id: MapProvider; label: string }[]
                    ).map(({ id, label }) => {
                      const sel = mapProvider === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            setProvider(id);
                            setMapStyleOpen(false);
                          }}
                          className={cn(
                            "w-full rounded-lg border px-3 py-2 text-left text-xs font-medium transition",
                            sel
                              ? "border-primary-500/40 bg-primary-500/12 text-white"
                              : "border-white/10 bg-white/[0.04] text-neutral-300 hover:bg-white/[0.08] hover:text-white",
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                      2D / 3D
                    </p>
                    {mapProvider === "leaflet" ? (
                      <Lock
                        className="size-3.5 shrink-0 text-neutral-500"
                        aria-hidden
                      />
                    ) : null}
                  </div>
                  <div className="mt-1.5 flex gap-1">
                    <button
                      type="button"
                      disabled={mapProvider === "leaflet"}
                      onClick={() => setMapViewMode("2d")}
                      className={cn(
                        "flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition",
                        mapViewMode === "2d"
                          ? "border-primary-500/40 bg-primary-500/12 text-white"
                          : "border-white/10 bg-white/[0.04] text-neutral-300 hover:bg-white/[0.08]",
                        mapProvider === "leaflet" &&
                          "cursor-not-allowed opacity-40 hover:bg-white/[0.04]",
                      )}
                    >
                      2D
                    </button>
                    <button
                      type="button"
                      disabled={
                        mapProvider === "leaflet" || deviceTier === "none"
                      }
                      onClick={() => setMapViewMode("3d")}
                      title={map3dHint}
                      className={cn(
                        "flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition",
                        mapViewMode === "3d"
                          ? "border-primary-500/40 bg-primary-500/12 text-white"
                          : "border-white/10 bg-white/[0.04] text-neutral-300 hover:bg-white/[0.08]",
                        (mapProvider === "leaflet" || deviceTier === "none") &&
                          "cursor-not-allowed opacity-40 hover:bg-white/[0.04]",
                      )}
                    >
                      3D
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <WeatherLayerMapControls
            placement="sidebar"
            overlay={overlay}
            setOverlay={setOverlay}
            openWeatherApiKey={openWeatherApiKey}
            radarStatus={radarStatus}
            radarMessage={radarMessage}
          />
        </SidebarGroup>
      </div>

      <div className="mt-1.5 min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="flex flex-col gap-1.5">
          <AnimatePresence>
            {showDrawActions ? (
              <motion.div
                key="mission-context"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
              >
                <SidebarGroup aria-label="Contexto de missão">
                  {hasPolygon ? (
                    <>
                      <SidebarButton
                        icon={Crosshair}
                        label={
                          poiPlacementActive
                            ? "Cancelar posicionamento do POI"
                            : "Adicionar ou mover POI (clique no mapa)"
                        }
                        active={poiPlacementActive}
                        activeColor="green"
                        onClick={() =>
                          setPoiPlacementActive(!poiPlacementActive)
                        }
                      />
                      {poi ? (
                        <>
                          <div className="mx-2 h-px bg-white/[0.07]" />
                          <SidebarButton
                            icon={Trash2}
                            label="Remover POI"
                            onClick={() => {
                              setPoi(null);
                              setPoiPlacementActive(false);
                            }}
                            activeColor="red"
                          />
                        </>
                      ) : null}
                      {hasDraft ? (
                        <div className="mx-2 h-px bg-white/[0.07]" />
                      ) : null}
                    </>
                  ) : null}

                  <SidebarButton
                    icon={Pentagon}
                    label="Fechar área"
                    disabled={!canClose}
                    onClick={onClose}
                    activeColor="green"
                  />
                  <div className="mx-2 h-px bg-white/[0.07]" />
                  <SidebarButton
                    icon={Undo2}
                    label="Desfazer último ponto (U/Z)"
                    disabled={!hasDraft}
                    onClick={() => popLastDraftPoint()}
                  />
                  <div className="mx-2 h-px bg-white/[0.07]" />
                  <SidebarButton
                    icon={Trash2}
                    label="Limpar área"
                    onClick={onClear}
                    activeColor="red"
                  />
                </SidebarGroup>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function SidebarGroup({
  children,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  "aria-label"?: string;
}) {
  return (
    <div
      role={ariaLabel ? "group" : undefined}
      aria-label={ariaLabel}
      className="flex flex-col rounded-xl border border-white/[0.09] bg-[#111]/90 shadow-lg backdrop-blur-md [&>*:first-child]:rounded-t-xl [&>*:last-child]:rounded-b-xl"
    >
      {children}
    </div>
  );
}

function SidebarButton({
  icon: Icon,
  label,
  active,
  onClick,
  disabled,
  activeColor = "neutral",
}: {
  icon: typeof Hand;
  label: string;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  activeColor?: "neutral" | "green" | "red";
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-12 w-12 items-center justify-center transition-all duration-150",
        "disabled:cursor-not-allowed disabled:opacity-25",
        active
          ? activeColor === "green"
            ? "bg-primary-500/20 text-primary-400"
            : activeColor === "red"
              ? "bg-red-500/20 text-red-400"
              : "bg-white/12 text-white"
          : activeColor === "green"
            ? "text-neutral-400 hover:bg-primary-500/10 hover:text-primary-300"
            : activeColor === "red"
              ? "text-neutral-400 hover:bg-red-500/10 hover:text-red-300"
              : "text-neutral-400 hover:bg-white/[0.08] hover:text-white",
      )}
    >
      <Icon className="size-[18px]" aria-hidden />
    </button>
  );
}
