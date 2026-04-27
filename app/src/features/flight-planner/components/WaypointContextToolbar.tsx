import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { Mountain, Navigation, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useFlightStore } from "@/features/flight-planner/stores/useFlightStore";
import type { Waypoint } from "@/features/flight-planner/types";
import { haptic } from "@/utils/haptics";
import { useBreakpoint, type Breakpoint } from "@/hooks/useBreakpoint";
import { touchTargetClass } from "@/lib/deviceUtils";
import { cn } from "@/lib/utils";

function toolbarBtnClass(bp: Breakpoint): string {
  return cn(
    "flex items-center justify-center rounded-xl border border-white/15 bg-[#1a1a1a]/95 text-neutral-100 shadow-lg backdrop-blur-sm transition hover:bg-white/10 active:scale-[0.97]",
    touchTargetClass(bp),
    bp === "tablet" ? "size-12" : "size-11",
  );
}

type WaypointContextToolbarProps = {
  waypoint: Waypoint;
  mapPosition: { x: number; y: number };
  onSetHome: () => void;
  onDelete: () => void;
  onEditAltitude: () => void;
};

function ToolbarInner({
  waypoint,
  mapPosition,
  onSetHome,
  onDelete,
  onEditAltitude,
}: WaypointContextToolbarProps) {
  const bp = useBreakpoint();
  const waypointCount = useFlightStore((s) => s.waypoints.length);

  return (
    <div
      role="toolbar"
      aria-label={`Ações rápidas do waypoint ${waypoint.index + 1}`}
      className={cn(
        "dd-wp-entra pointer-events-auto flex flex-row items-center gap-1 rounded-2xl border border-white/12 bg-[#141414]/95 p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.55)] backdrop-blur-md",
      )}
      style={{
        position: "absolute",
        left: mapPosition.x,
        top: mapPosition.y,
        transform: "translate(-50%, calc(-100% - 14px))",
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className={toolbarBtnClass(bp)}
        title="Definir início da rota aqui"
        aria-label="Definir início da rota neste waypoint"
        onClick={() => {
          haptic.light();
          onSetHome();
        }}
      >
        <Navigation className="size-[1.125rem] text-primary-400" aria-hidden />
      </button>
      <button
        type="button"
        className={toolbarBtnClass(bp)}
        title="Editar altitude"
        aria-label="Editar altitude no painel"
        onClick={() => {
          haptic.light();
          onEditAltitude();
        }}
      >
        <Mountain className="size-[1.125rem] text-sky-400" aria-hidden />
      </button>
      <button
        type="button"
        disabled={waypointCount <= 1}
        className={cn(
          toolbarBtnClass(bp),
          waypointCount <= 1 && "pointer-events-none opacity-40",
        )}
        title={waypointCount <= 1 ? "Único waypoint" : "Remover waypoint"}
        aria-label="Remover waypoint"
        onClick={() => {
          if (waypointCount <= 1) return;
          haptic.medium();
          onDelete();
        }}
      >
        <Trash2 className="size-[1.125rem] text-red-400" aria-hidden />
      </button>
    </div>
  );
}

/**
 * Barra contextual flutuante junto ao waypoint selecionado (Leaflet).
 * Coordenadas em px do container do mapa; atualiza em move/zoom/resize.
 */
export function WaypointContextToolbar() {
  const map = useMap();
  const selectedId = useFlightStore((s) => s.selectedWaypointId);
  const waypoints = useFlightStore((s) => s.waypoints);
  const setSelectedWaypoint = useFlightStore((s) => s.setSelectedWaypoint);
  const setRouteStartRef = useFlightStore((s) => s.setRouteStartRef);
  const removeWaypoint = useFlightStore((s) => s.removeWaypoint);

  const waypoint = useMemo(
    () => (selectedId ? waypoints.find((w) => w.id === selectedId) : undefined),
    [selectedId, waypoints],
  );

  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const updatePosition = useCallback(() => {
    if (!waypoint) {
      setPos(null);
      return;
    }
    const ll = L.latLng(waypoint.lat, waypoint.lng);
    const p = map.latLngToContainerPoint(ll);
    const size = map.getSize();
    const pad = 56;
    const x = Math.min(Math.max(p.x, pad), Math.max(pad, size.x - pad));
    const y = Math.min(Math.max(p.y, pad), Math.max(pad, size.y - pad));
    setPos({ x, y });
  }, [map, waypoint]);

  useLayoutEffect(() => {
    updatePosition();
  }, [updatePosition, waypoint?.id, waypoint?.lat, waypoint?.lng]);

  useEffect(() => {
    if (!waypoint) return;
    const on = () => {
      requestAnimationFrame(updatePosition);
    };
    map.on("move", on);
    map.on("zoom", on);
    map.on("zoomend", on);
    map.on("moveend", on);
    map.on("resize", on);
    return () => {
      map.off("move", on);
      map.off("zoom", on);
      map.off("zoomend", on);
      map.off("moveend", on);
      map.off("resize", on);
    };
  }, [map, waypoint, updatePosition]);

  const onSetHome = useCallback(() => {
    setRouteStartRef({ lat: waypoint!.lat, lng: waypoint!.lng });
    toast("Ponto de início da rota definido", { duration: 2500 });
  }, [setRouteStartRef, waypoint]);

  const onDelete = useCallback(() => {
    if (!waypoint) return;
    const n = useFlightStore.getState().waypoints.length;
    if (n <= 1) return;
    if (useFlightStore.getState().selectedWaypointId === waypoint.id) {
      setSelectedWaypoint(null);
    }
    removeWaypoint(waypoint.id);
    toast("Waypoint removido", {
      action: {
        label: "Desfazer",
        onClick: () => {
          useFlightStore.getState().undo();
          haptic.light();
        },
      },
      duration: 10_000,
    });
  }, [removeWaypoint, setSelectedWaypoint, waypoint]);

  const onEditAltitude = useCallback(() => {
    requestAnimationFrame(() => {
      document.getElementById("waypoint-alt-range")?.focus();
    });
  }, []);

  if (!waypoint || !pos) return null;

  const container = map.getContainer();
  if (!container) return null;

  return createPortal(
    <div
      className="pointer-events-none absolute inset-0 z-[1100] overflow-visible"
      aria-hidden={false}
    >
      <ToolbarInner
        waypoint={waypoint}
        mapPosition={pos}
        onSetHome={onSetHome}
        onDelete={onDelete}
        onEditAltitude={onEditAltitude}
      />
    </div>,
    container,
  );
}
