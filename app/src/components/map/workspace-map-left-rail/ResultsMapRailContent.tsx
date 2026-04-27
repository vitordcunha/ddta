import * as Popover from "@radix-ui/react-popover";
import {
  Crosshair,
  SlidersHorizontal,
  Square,
  Trash2,
  Ruler,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui";
import { useResultsViewStore } from "@/features/results/stores/useResultsViewStore";
import type { DeviceTier } from "@/features/map-engine/utils/detectDeviceTier";
import { LeftRailIconPopoverTrigger } from "./LeftRailIconPopoverTrigger";
import { LeftRailPopoverContent } from "./LeftRailPopoverContent";
import { MapLeftRailMapNavBlock } from "./MapLeftRailMapNavBlock";

type ResultsMapRailContentProps = {
  deviceTier: DeviceTier;
};

export function ResultsMapRailContent({
  deviceTier,
}: ResultsMapRailContentProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const activeLayer = useResultsViewStore((s) => s.activeLayer);
  const tool = useResultsViewStore((s) => s.tool);
  const setTool = useResultsViewStore((s) => s.setTool);
  const clearDrawing = useResultsViewStore((s) => s.clearDrawing);
  const canMeasure = activeLayer !== "orthophoto";

  return (
    <div className="mt-auto flex shrink-0 flex-col gap-1.5 pt-1.5">
      <Popover.Root open={moreOpen} onOpenChange={setMoreOpen} modal>
        <LeftRailIconPopoverTrigger
          deviceTier={deviceTier}
          open={moreOpen}
          title="Medir distancia, area, cota"
          aria-label="Ferramentas de medida no mapa"
          icon={SlidersHorizontal}
        />
        <LeftRailPopoverContent
          deviceTier={deviceTier}
          maxHeight="28rem"
          className="p-2.5"
        >
          {canMeasure ? (
            <div
              className="flex flex-col gap-1.5"
              role="group"
              aria-label="Medir no mapa"
            >
              <Button
                type="button"
                size="sm"
                className="touch-manipulation h-11 w-full min-h-11 justify-start"
                variant={tool === "distance" ? "primary" : "outline"}
                onClick={() => {
                  setTool("distance");
                  setMoreOpen(false);
                }}
              >
                <Ruler className="mr-2 size-4 shrink-0" />
                Distancia
              </Button>
              <Button
                type="button"
                size="sm"
                className="touch-manipulation h-11 w-full min-h-11 justify-start"
                variant={tool === "area" ? "primary" : "outline"}
                onClick={() => {
                  setTool("area");
                  setMoreOpen(false);
                }}
              >
                <Square className="mr-2 size-4 shrink-0" />
                Area
              </Button>
              <Button
                type="button"
                size="sm"
                className="touch-manipulation h-11 w-full min-h-11 justify-start"
                variant={tool === "elevation" ? "primary" : "outline"}
                onClick={() => {
                  setTool("elevation");
                  setMoreOpen(false);
                }}
              >
                <Crosshair className="mr-2 size-4 shrink-0" />
                Cota
              </Button>
              <Button
                type="button"
                size="sm"
                className="touch-manipulation h-11 w-full min-h-11 justify-start"
                variant="outline"
                onClick={() => {
                  clearDrawing();
                  setMoreOpen(false);
                }}
              >
                <Trash2 className="mr-2 size-4 shrink-0" />
                Limpar
              </Button>
            </div>
          ) : (
            <p className="px-1 text-xs leading-snug text-neutral-500">
              Medidas nao aplicaveis a esta camada. Troque a camada de
              visualizacao no painel a direita.
            </p>
          )}
        </LeftRailPopoverContent>
      </Popover.Root>
      <MapLeftRailMapNavBlock deviceTier={deviceTier} showFitProject />
    </div>
  );
}
