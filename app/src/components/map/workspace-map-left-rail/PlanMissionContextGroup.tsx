import * as Popover from "@radix-ui/react-popover";
import { AnimatePresence, motion } from "framer-motion";
import { Crosshair, MapPin, Pentagon, Trash2, Undo2 } from "lucide-react";
import { maybeBackdropBlur } from "@/lib/deviceUtils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui";
import type { DeviceTier } from "@/features/map-engine/utils/detectDeviceTier";
import type { PointOfInterest } from "@/features/flight-planner/types/poi";
import { LeftRailPopoverContent } from "./LeftRailPopoverContent";
import { SidebarButton } from "./SidebarButton";
import { SidebarGroup } from "./SidebarGroup";

type PlanMissionContextGroupProps = {
  show: boolean;
  deviceTier: DeviceTier;
  hasPolygon: boolean;
  hasDraft: boolean;
  canClose: boolean;
  poiMenuOpen: boolean;
  setPoiMenuOpen: (open: boolean) => void;
  poiPlacementActive: boolean;
  setPoiPlacementActive: (active: boolean) => void;
  poi: PointOfInterest | null;
  setPoi: (poi: PointOfInterest | null) => void;
  onClose: () => void;
  onClear: () => void;
  popLastDraftPoint: () => void;
};

export function PlanMissionContextGroup({
  show,
  deviceTier,
  hasPolygon,
  hasDraft,
  canClose,
  poiMenuOpen,
  setPoiMenuOpen,
  poiPlacementActive,
  setPoiPlacementActive,
  poi,
  setPoi,
  onClose,
  onClear,
  popLastDraftPoint,
}: PlanMissionContextGroupProps) {
  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          key="mission-context"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
        >
          <SidebarGroup deviceTier={deviceTier} aria-label="Contexto de missao">
            {hasPolygon ? (
              <>
                <Popover.Root
                  open={poiMenuOpen}
                  onOpenChange={setPoiMenuOpen}
                  modal
                >
                  <Popover.Trigger asChild>
                    <button
                      type="button"
                      title="Ponto de interesse (POI)"
                      aria-label="Abrir opcoes de POI: posicionar ou remover"
                      aria-pressed={poiMenuOpen}
                      className={cn(
                        "touch-manipulation flex h-12 w-12 items-center justify-center transition-all duration-150 md:max-lg:h-10 md:max-lg:w-10",
                        poiPlacementActive
                          ? "bg-primary-500/20 text-primary-400"
                          : poiMenuOpen
                            ? "bg-primary-500/15 text-primary-300"
                            : "text-neutral-400 hover:bg-primary-500/10 hover:text-primary-300",
                      )}
                    >
                      <MapPin
                        className="size-[18px] md:max-lg:size-4"
                        aria-hidden
                      />
                    </button>
                  </Popover.Trigger>
                  <LeftRailPopoverContent
                    deviceTier={deviceTier}
                    maxHeight="22rem"
                  >
                    <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                      Ponto de interesse
                    </p>
                    <div className="flex flex-col gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        className="touch-manipulation h-11 w-full min-h-11 justify-start"
                        variant={poiPlacementActive ? "primary" : "outline"}
                        onClick={() => {
                          setPoiPlacementActive(!poiPlacementActive);
                          if (!poiPlacementActive) {
                            setPoiMenuOpen(false);
                          }
                        }}
                      >
                        <Crosshair className="mr-2 size-4 shrink-0" />
                        {poiPlacementActive
                          ? "Cancelar posicionamento"
                          : "Posicionar no mapa"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="touch-manipulation h-11 w-full min-h-11 justify-start"
                        variant="outline"
                        disabled={!poi}
                        onClick={() => {
                          if (!poi) return;
                          setPoi(null);
                          setPoiPlacementActive(false);
                          setPoiMenuOpen(false);
                        }}
                      >
                        <Trash2 className="mr-2 size-4 shrink-0" />
                        Remover POI
                      </Button>
                    </div>
                    <p
                      className={cn(
                        "mt-2.5 text-[11px] leading-relaxed",
                        poi ? "text-neutral-400" : "text-neutral-500",
                      )}
                    >
                      {poi
                        ? "Toque em Posicionar no mapa e clique no local desejado para mover o POI."
                        : "Ainda nao ha POI. Use Posicionar no mapa e clique no mapa para definir."}
                    </p>
                  </LeftRailPopoverContent>
                </Popover.Root>
                {hasDraft ? (
                  <div className="mx-2 h-px bg-white/[0.07]" />
                ) : null}
              </>
            ) : null}

            <SidebarButton
              icon={Pentagon}
              label="Fechar area"
              disabled={!canClose}
              onClick={onClose}
              activeColor="green"
            />
            <div className="mx-2 h-px bg-white/[0.07]" />
            <SidebarButton
              icon={Undo2}
              label="Desfazer ultimo ponto (U/Z)"
              disabled={!hasDraft}
              onClick={() => popLastDraftPoint()}
            />
            <div className="mx-2 h-px bg-white/[0.07]" />
            <SidebarButton
              icon={Trash2}
              label="Limpar area"
              onClick={onClear}
              activeColor="red"
            />
          </SidebarGroup>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
