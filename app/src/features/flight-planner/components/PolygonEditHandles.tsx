import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import type { Feature, Polygon } from "geojson";
import L from "leaflet";
import { Trash2 } from "lucide-react";
import { Marker, Tooltip, useMap } from "react-leaflet";
import { useMapEngine } from "@/features/map-engine/useMapEngine";
import {
  attachHoldStillLongPressToElement,
  MAP_LONG_PRESS_MARKER_TOUCH_SLOP_PX,
} from "@/features/flight-planner/utils/mapLongPress";
import { haptic } from "@/utils/haptics";
import {
  RadialContextMenu,
  type RadialMenuItem,
} from "@/features/map-engine/components/RadialContextMenu";
import { toast } from "sonner";
import { useFlightStore } from "@/features/flight-planner/stores/useFlightStore";

export interface PolygonEditHandlesProps {
  polygon: Feature<Polygon> | null;
  editable: boolean;
  onVertexMove: (index: number, newLatLng: [number, number]) => void;
  onVertexDelete: (index: number) => void;
  onMidpointInsert: (afterIndex: number, newLatLng: [number, number]) => void;
}

function mkVertexIcon(size: number, opacity: number): L.DivIcon {
  const hit = 44;
  return L.divIcon({
    className: "polygon-vertex-handle",
    iconSize: [hit, hit],
    iconAnchor: [hit / 2, hit / 2],
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:#3b82f6;border:2.5px solid #fff;
      box-shadow:0 1px 4px rgba(0,0,0,.6);
      margin:${(hit - size) / 2}px;
      opacity:${opacity};
      touch-action:none;
    "/>`,
  });
}

function mkMidpointIcon(): L.DivIcon {
  const hit = 36;
  const s = 12;
  return L.divIcon({
    className: "polygon-midpoint-handle",
    iconSize: [hit, hit],
    iconAnchor: [hit / 2, hit / 2],
    html: `<div style="
      width:${s}px;height:${s}px;border-radius:50%;
      background:rgba(59,130,246,0.45);border:2px solid #93c5fd;
      margin:${(hit - s) / 2}px;
    "/>`,
  });
}

const VERTEX_ICON = mkVertexIcon(18, 1);
const MIDPOINT_ICON = mkMidpointIcon();

const VERTEX_MENU_ITEMS: RadialMenuItem[] = [
  {
    id: "delete",
    icon: Trash2,
    label: "Deletar vértice",
    colorClass: "text-red-400",
    bgClass: "bg-neutral-900/95 hover:bg-red-950/80",
  },
];

interface VertexHandleProps {
  lat: number;
  lng: number;
  index: number;
  total: number;
  onMove: (index: number, latLng: [number, number]) => void;
  onDelete: (index: number) => void;
}

function VertexHandle({
  lat,
  lng,
  index,
  total,
  onMove,
  onDelete,
}: VertexHandleProps) {
  const { disableMapPan, enableMapPan } = useMapEngine();
  const markerRef = useRef<L.Marker | null>(null);
  const holdCtlRef = useRef<{
    cancelActiveHold: () => void;
    detach: () => void;
  } | null>(null);
  const shouldIgnoreLongPressRef = useRef(false);
  const pressCoordRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const openedViaHoldRef = useRef(false);
  const [showMenu, setShowMenu] = useState(false);

  const performDelete = useCallback(() => {
    if (total <= 3) {
      setShowMenu(false);
      return;
    }
    setShowMenu(false);
    haptic.medium();
    onDelete(index);
    toast("Vértice removido", {
      action: {
        label: "Desfazer",
        onClick: () => {
          useFlightStore.getState().undo();
          haptic.light();
        },
      },
      duration: 8_000,
    });
  }, [total, index, onDelete]);

  const cancelHold = useCallback(() => {
    holdCtlRef.current?.cancelActiveHold();
  }, []);

  const handleDragStart = useCallback(() => {
    cancelHold();
    disableMapPan();
    haptic.medium();
  }, [cancelHold, disableMapPan]);

  const handleDragEnd = useCallback(
    (e: L.LeafletEvent) => {
      enableMapPan();
      const marker = e.target as L.Marker;
      const ll = marker.getLatLng();
      onMove(index, [ll.lat, ll.lng]);
    },
    [enableMapPan, index, onMove],
  );

  useLayoutEffect(() => {
    shouldIgnoreLongPressRef.current = showMenu;
  }, [showMenu]);

  useEffect(() => {
    if (showMenu) return undefined;

    let cancelled = false;
    let raf = 0;
    let attempts = 0;
    let ctl: ReturnType<typeof attachHoldStillLongPressToElement> | null = null;

    const tryAttach = () => {
      if (cancelled) return;
      const el = markerRef.current?.getElement();
      if (!el) {
        attempts += 1;
        if (attempts < 20) {
          raf = requestAnimationFrame(tryAttach);
        }
        return;
      }
      ctl = attachHoldStillLongPressToElement(el, {
        shouldIgnore: () => shouldIgnoreLongPressRef.current,
        slopPx: MAP_LONG_PRESS_MARKER_TOUCH_SLOP_PX,
        onStart: (coords) => {
          pressCoordRef.current = coords;
        },
        onFire: () => {
          if (total <= 3) return; // sem ação disponível
          openedViaHoldRef.current = true;
          haptic.heavy();
          setShowMenu(true);
        },
      });
      holdCtlRef.current = ctl;
    };

    tryAttach();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ctl?.detach();
      holdCtlRef.current = null;
    };
  }, [lat, lng, showMenu, total]);

  const handleMenuSelect = useCallback(
    (id: string) => {
      if (id === "delete") performDelete();
      setShowMenu(false);
      openedViaHoldRef.current = false;
    },
    [performDelete],
  );

  const handleMenuDismiss = useCallback(() => {
    setShowMenu(false);
    openedViaHoldRef.current = false;
  }, []);

  const menuItems = total > 3 ? VERTEX_MENU_ITEMS : [];

  return (
    <>
      <Marker
        ref={markerRef}
        position={[lat, lng]}
        icon={VERTEX_ICON}
        draggable={!showMenu}
        zIndexOffset={700}
        eventHandlers={
          {
            dragstart: handleDragStart,
            dragend: handleDragEnd,
          } as ComponentProps<typeof Marker>["eventHandlers"]
        }
      >
        {!showMenu ? (
          <Tooltip direction="top" offset={[0, -12]}>
            Vértice {index + 1}
            {total > 3 ? " — segure para excluir" : ""}
          </Tooltip>
        ) : null}
      </Marker>

      {showMenu && menuItems.length > 0 ? (
        <RadialContextMenu
          position={pressCoordRef.current}
          items={menuItems}
          onSelect={handleMenuSelect}
          onDismiss={handleMenuDismiss}
          openedViaHold={openedViaHoldRef.current}
        />
      ) : null}
    </>
  );
}

interface MidpointHandleProps {
  lat: number;
  lng: number;
  afterIndex: number;
  onInsert: (afterIndex: number, latLng: [number, number]) => void;
}

function MidpointHandle({
  lat,
  lng,
  afterIndex,
  onInsert,
}: MidpointHandleProps) {
  const { disableMapPan, enableMapPan } = useMapEngine();

  const handleDragStart = useCallback(() => {
    disableMapPan();
    haptic.light();
  }, [disableMapPan]);

  const handleDragEnd = useCallback(
    (e: L.LeafletEvent) => {
      enableMapPan();
      const marker = e.target as L.Marker;
      const ll = marker.getLatLng();
      onInsert(afterIndex, [ll.lat, ll.lng]);
    },
    [enableMapPan, afterIndex, onInsert],
  );

  return (
    <Marker
      position={[lat, lng]}
      icon={MIDPOINT_ICON}
      draggable
      zIndexOffset={600}
      eventHandlers={{ dragstart: handleDragStart, dragend: handleDragEnd }}
    >
      <Tooltip direction="top" offset={[0, -10]}>
        Arrastar para inserir vértice
      </Tooltip>
    </Marker>
  );
}

/**
 * Módulo 5: Handles de edição de polígono — vértices arrastáveis e midpoints
 * para inserção de novos vértices. Visível apenas quando `editable === true`
 * (painel de configuração aberto).
 */
export function PolygonEditHandles({
  polygon,
  editable,
  onVertexMove,
  onVertexDelete,
  onMidpointInsert,
}: PolygonEditHandlesProps) {
  useMap(); // Necessário para confirmar que estamos dentro de um MapContainer

  if (!editable || !polygon) return null;

  const ring = polygon.geometry.coordinates[0];
  // O anel GeoJSON tem o primeiro e último ponto idênticos; omitimos o último.
  const vertices = ring.slice(0, -1).map(([lng, lat]) => ({ lat, lng }));
  const total = vertices.length;

  const midpoints = vertices.map((v, i) => {
    const next = vertices[(i + 1) % total]!;
    return {
      lat: (v.lat + next.lat) / 2,
      lng: (v.lng + next.lng) / 2,
      afterIndex: i,
    };
  });

  return (
    <>
      {vertices.map((v, i) => (
        <VertexHandle
          key={`vertex-${i}-${v.lat.toFixed(6)}-${v.lng.toFixed(6)}`}
          lat={v.lat}
          lng={v.lng}
          index={i}
          total={total}
          onMove={onVertexMove}
          onDelete={onVertexDelete}
        />
      ))}
      {midpoints.map((m, i) => (
        <MidpointHandle
          key={`mid-${i}-${m.lat.toFixed(6)}-${m.lng.toFixed(6)}`}
          lat={m.lat}
          lng={m.lng}
          afterIndex={m.afterIndex}
          onInsert={onMidpointInsert}
        />
      ))}
    </>
  );
}
