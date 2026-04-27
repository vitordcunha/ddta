import { useResultsMapMeasurements } from "@/features/results/hooks/useResultsMapMeasurements";
import { useResultsViewStore } from "@/features/results/stores/useResultsViewStore";

/**
 * Exibe resultados de medida (canto inferior direito). As ferramentas de desenho
 * estao no WorkspaceMapLeftRail (modo resultados).
 */
export function ResultsMapToolsOverlay() {
  const activeLayer = useResultsViewStore((s) => s.activeLayer);
  const { distanceResult, areaResult, elevationPoint } =
    useResultsMapMeasurements();

  if (activeLayer === "orthophoto") return null;

  if (!distanceResult && !areaResult && !elevationPoint) return null;

  return (
    <div
      className="pointer-events-auto absolute bottom-3 z-[2000] max-w-xs rounded-xl border border-[#2e2e2e] bg-[#171717]/90 p-3 text-xs text-neutral-200 backdrop-blur-md"
      style={{ right: "calc(var(--right-panel-width, 0px) + 0.75rem)" }}
    >
      {distanceResult ? <p>Distancia: {distanceResult}</p> : null}
      {areaResult ? <p>Area: {areaResult}</p> : null}
      {elevationPoint ? <p>Cota: 1.024,3 m (datum WGS84)</p> : null}
    </div>
  );
}
