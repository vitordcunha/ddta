import * as Popover from "@radix-ui/react-popover";
import { AnimatePresence, motion } from "framer-motion";
import {
  Crosshair,
  MapPin,
  MoreHorizontal,
  Pentagon,
  Trash2,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui";
import type { DeviceTier } from "@/features/map-engine/utils/detectDeviceTier";
import type { PointOfInterest } from "@/features/flight-planner/types/poi";
import { LeftRailPopoverContent } from "./LeftRailPopoverContent";
import { SidebarButton } from "./SidebarButton";
import { SidebarDivider } from "./SidebarDivider";
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
            {/* POI — só quando há polígono fechado */}
            {hasPolygon ? (
              <>
                <Popover.Root
                  open={poiMenuOpen}
                  onOpenChange={setPoiMenuOpen}
                  modal
                >
                  <Popover.Trigger asChild>
                    <SidebarButton
                      icon={MapPin}
                      label="Abrir opcoes de POI: posicionar ou remover"
                      title="Ponto de interesse (POI)"
                      active={poiPlacementActive}
                      open={poiMenuOpen}
                      activeColor="green"
                    />
                  </Popover.Trigger>
                  <LeftRailPopoverContent deviceTier={deviceTier} maxHeight="22rem">
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
                          if (!poiPlacementActive) setPoiMenuOpen(false);
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
                {hasDraft ? <SidebarDivider /> : null}
              </>
            ) : null}

            {/* Fechar área — ação primária de desenho */}
            <SidebarButton
              icon={Pentagon}
              label="Fechar area"
              disabled={!canClose}
              onClick={onClose}
              activeColor="green"
            />
            <SidebarDivider />

            {/* Overflow: Desfazer + Limpar */}
            <OverflowActionsPopover
              deviceTier={deviceTier}
              hasDraft={hasDraft}
              onUndo={popLastDraftPoint}
              onClear={onClear}
            />
          </SidebarGroup>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

type OverflowActionsPopoverProps = {
  deviceTier: DeviceTier;
  hasDraft: boolean;
  onUndo: () => void;
  onClear: () => void;
};

function OverflowActionsPopover({
  deviceTier,
  hasDraft,
  onUndo,
  onClear,
}: OverflowActionsPopoverProps) {
  return (
    <Popover.Root modal>
      <Popover.Trigger asChild>
        {/* open não está disponível via props neste padrão não-controlado;
            o SidebarButton usa aria-pressed=false por padrão, ok aqui */}
        <SidebarButton
          icon={MoreHorizontal}
          label="Mais acoes: desfazer e limpar"
        />
      </Popover.Trigger>
      <LeftRailPopoverContent deviceTier={deviceTier} maxHeight="22rem">
        <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
          Acoes de desenho
        </p>
        <div className="flex flex-col gap-1.5">
          <Button
            type="button"
            size="sm"
            className="touch-manipulation h-11 w-full min-h-11 justify-start"
            variant="outline"
            disabled={!hasDraft}
            onClick={onUndo}
          >
            <Undo2 className="mr-2 size-4 shrink-0" />
            Desfazer ultimo ponto
          </Button>
          <Button
            type="button"
            size="sm"
            className="touch-manipulation h-11 w-full min-h-11 justify-start text-red-300 hover:text-red-200"
            variant="outline"
            onClick={onClear}
          >
            <Trash2 className="mr-2 size-4 shrink-0" />
            Limpar area
          </Button>
        </div>
      </LeftRailPopoverContent>
    </Popover.Root>
  );
}
