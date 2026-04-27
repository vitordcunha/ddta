import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { CircleMarker, Polyline, Tooltip } from "react-leaflet";
import {
  MappingPolygonAnimated,
  StripPolylineAnimated,
  SweepScanLineAnimated,
} from "@/features/flight-planner/components/PlanLeafletPathAnimations";
import { DrawingToolbar } from "@/features/flight-planner/components/DrawingToolbar";
import { useFlightStore } from "@/features/flight-planner/stores/useFlightStore";
import type { Strip } from "@/features/flight-planner/types";
import { haptic } from "@/utils/haptics";

type StripPath = { id: string; positions: [number, number][] };

function buildStripPaths(strips: Strip[]): StripPath[] {
  return strips.map((strip) => ({
    id: strip.id,
    positions: strip.coordinates.map(
      ([lon, lat]) => [lat, lon] as [number, number],
    ),
  }));
}

/**
 * Strips, animação de saída e linha de varredura: subscrição mínima a `strips`
 * para não re-renderizar o restante do mapa quando outros campos do plano mudam.
 */
export const FlightPlannerMapMissionStrips = memo(
  function FlightPlannerMapMissionStrips({
    muteFullMission,
  }: {
    muteFullMission: boolean;
  }) {
    const strips = useFlightStore((s) => s.strips);

    const [exitStrips, setExitStrips] = useState<Strip[]>([]);
    const exitStripsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
      null,
    );
    const prevStripsRef = useRef<Strip[]>(strips);

    useEffect(() => {
      if (prevStripsRef.current === strips) return;
      const prev = prevStripsRef.current;
      prevStripsRef.current = strips;
      if (prev.length === 0) return;
      if (exitStripsTimerRef.current) clearTimeout(exitStripsTimerRef.current);
      setExitStrips(prev);
      exitStripsTimerRef.current = setTimeout(() => {
        setExitStrips([]);
        exitStripsTimerRef.current = null;
      }, 280);
    }, [strips]);

    const currentPaths = useMemo(() => buildStripPaths(strips), [strips]);
    const exitPaths = useMemo(() => buildStripPaths(exitStrips), [exitStrips]);

    const stripsAnimVersion = useMemo(() => {
      if (strips.length === 0) return "";
      return `${strips.length}:${strips[0]!.id}`;
    }, [strips]);

    const sweepPath = useMemo((): [number, number][] => {
      if (strips.length < 2) return [];
      return strips
        .map((s) => {
          const coords = s.coordinates;
          if (coords.length < 2) return null;
          const mid = Math.floor(coords.length / 2);
          const [lon, lat] = coords[mid]!;
          return [lat, lon] as [number, number];
        })
        .filter((p): p is [number, number] => p !== null);
    }, [strips]);

    return (
      <>
        {exitPaths.map((row, stripIdx) => (
          <StripPolylineAnimated
            key={`exit-${row.id}`}
            staggerIndex={stripIdx}
            totalStrips={exitPaths.length}
            isExiting
            positions={row.positions}
            pathOptions={{ color: "#00c573", weight: 2, opacity: 0.75 }}
          />
        ))}
        {currentPaths.map((row, stripIdx) => (
          <StripPolylineAnimated
            key={row.id}
            staggerIndex={stripIdx}
            totalStrips={currentPaths.length}
            positions={row.positions}
            pathOptions={
              muteFullMission
                ? {
                    color: "#94a3b8",
                    weight: 1.5,
                    opacity: 0.38,
                    dashArray: "5 7",
                  }
                : { color: "#00c573", weight: 2, opacity: 0.75 }
            }
          />
        ))}
        {!muteFullMission && sweepPath.length >= 2 ? (
          <SweepScanLineAnimated
            key={stripsAnimVersion}
            positions={sweepPath}
          />
        ) : null}
      </>
    );
  },
);

/**
 * Rascunho de polígono (pontos + traco + toolbar em portal).
 */
export const FlightPlannerMapDraftLayer = memo(function FlightPlannerMapDraftLayer() {
  const draftPoints = useFlightStore((s) => s.draftPoints);
  const isDrawMode = useFlightStore((s) => s.plannerInteractionMode === "draw");
  const popLastDraftPoint = useFlightStore((s) => s.popLastDraftPoint);
  const closeDraft = useFlightStore((s) => s.closeDraft);
  const setDraftPoints = useFlightStore((s) => s.setDraftPoints);
  const setPlannerInteractionMode = useFlightStore(
    (s) => s.setPlannerInteractionMode,
  );

  const handleDrawingCancel = useCallback(() => {
    setDraftPoints([]);
    setPlannerInteractionMode("navigate");
    haptic.medium();
  }, [setDraftPoints, setPlannerInteractionMode]);

  const handleDrawingComplete = useCallback(() => {
    closeDraft();
    setPlannerInteractionMode("navigate");
    haptic.success();
  }, [closeDraft, setPlannerInteractionMode]);

  return (
    <>
      {createPortal(
        <DrawingToolbar
          visible={isDrawMode}
          canUndo={draftPoints.length > 0}
          canComplete={draftPoints.length >= 3}
          onUndo={() => {
            haptic.light();
            popLastDraftPoint();
          }}
          onCancel={handleDrawingCancel}
          onComplete={handleDrawingComplete}
        />,
        document.body,
      )}
      {draftPoints.map((pt, i) => {
        const isFirst = i === 0;
        const canCloseHere = isFirst && draftPoints.length > 2;
        return (
          <CircleMarker
            key={`draft-${i}-${pt[0]}-${pt[1]}`}
            center={pt}
            radius={canCloseHere ? 8 : 4}
            pathOptions={{
              className: "dd-map-draft-vert",
              color: canCloseHere ? "#3ecf8e" : "#60A5FA",
              weight: canCloseHere ? 2.5 : 1.5,
              fillColor: canCloseHere
                ? "rgba(62, 207, 142, 0.35)"
                : "rgba(96, 165, 250, 0.45)",
              fillOpacity: 0.9,
            }}
          >
            {canCloseHere ? (
              <Tooltip direction="top" offset={[0, -6]}>
                Fechar poligono
              </Tooltip>
            ) : null}
          </CircleMarker>
        );
      })}

      {draftPoints.length > 1 && (
        <Polyline
          positions={draftPoints}
          pathOptions={{
            className: "dd-map-draft-line",
            color: "#60A5FA",
            dashArray: "4 4",
            weight: 2,
          }}
        />
      )}
    </>
  );
});

/**
 * Preenchimento do poligono de missao (fora do footprint FOV, tratado no pai).
 */
export const FlightPlannerMapMissionPolygon = memo(
  function FlightPlannerMapMissionPolygon({
    pulseVersion,
    muteFullMission,
  }: {
    pulseVersion: number;
    muteFullMission: boolean;
  }) {
    const polygon = useFlightStore((s) => s.polygon);
    const polygonCoords = useMemo(
      () =>
        polygon?.geometry.coordinates[0].map(
          ([lon, lat]) => [lat, lon] as [number, number],
        ) ?? [],
      [polygon],
    );

    if (polygonCoords.length === 0) return null;

    return (
      <MappingPolygonAnimated
        enableEnter
        pulseVersion={pulseVersion}
        positions={polygonCoords}
        pathOptions={
          muteFullMission
            ? {
                color: "#64748b",
                fillColor: "#475569",
                fillOpacity: 0.1,
                weight: 2,
              }
            : {
                color: "#3ecf8e",
                fillOpacity: 0.18,
                weight: 2,
              }
        }
      />
    );
  },
);
