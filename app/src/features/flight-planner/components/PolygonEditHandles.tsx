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
import { Marker, Popup, Tooltip, useMap } from "react-leaflet";
import { usePointerPressHighlightOverButton } from "@/features/flight-planner/hooks/usePointerPressHighlightOverButton";
import { useMapEngine } from "@/features/map-engine/useMapEngine";
import {
  attachHoldStillLongPressToElement,
  isReleaseOverElement,
  MAP_LONG_PRESS_MARKER_TOUCH_SLOP_PX,
} from "@/features/flight-planner/utils/mapLongPress";
import { cn } from "@/lib/utils";
import { haptic } from "@/utils/haptics";

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
  const openedViaHoldRef = useRef(false);
  const deleteBtnRef = useRef<HTMLButtonElement | null>(null);
  const [showDeleteMenu, setShowDeleteMenu] = useState(false);

  const performVertexDelete = useCallback(() => {
    if (total <= 3) {
      setShowDeleteMenu(false);
      return;
    }
    setShowDeleteMenu(false);
    onDelete(index);
  }, [total, index, onDelete]);

  const deletePressed = usePointerPressHighlightOverButton(
    showDeleteMenu && total > 3,
    deleteBtnRef,
  );

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
    shouldIgnoreLongPressRef.current = showDeleteMenu;
  }, [showDeleteMenu]);

  useEffect(() => {
    if (showDeleteMenu) return undefined;

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
        onFire: () => {
          openedViaHoldRef.current = true;
          haptic.heavy();
          setShowDeleteMenu(true);
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
  }, [lat, lng, showDeleteMenu]);

  useEffect(() => {
    const m = markerRef.current;
    if (!m) return undefined;
    if (!showDeleteMenu) {
      m.closePopup();
      openedViaHoldRef.current = false;
      return undefined;
    }
    // O Popup do react-leaflet faz bind num efeito filho; abrir no próximo tick evita openPopup cedo demais.
    const t = window.setTimeout(() => {
      m.openPopup();
    }, 0);
    return () => clearTimeout(t);
  }, [showDeleteMenu]);

  useEffect(() => {
    if (!showDeleteMenu) return undefined;
    const onRelease = (e: Event) => {
      if (!openedViaHoldRef.current) return;
      openedViaHoldRef.current = false;
      if (total <= 3) return;
      const btn = deleteBtnRef.current;
      if (!btn || !isReleaseOverElement(btn, e)) return;
      e.preventDefault();
      e.stopPropagation();
      performVertexDelete();
    };
    window.addEventListener("pointerup", onRelease, true);
    window.addEventListener("touchend", onRelease, true);
    return () => {
      window.removeEventListener("pointerup", onRelease, true);
      window.removeEventListener("touchend", onRelease, true);
    };
  }, [showDeleteMenu, total, performVertexDelete]);

  return (
    <Marker
      ref={markerRef}
      position={[lat, lng]}
      icon={VERTEX_ICON}
      draggable={!showDeleteMenu}
      zIndexOffset={700}
      eventHandlers={
        {
          dragstart: handleDragStart,
          dragend: handleDragEnd,
          popupclose: () => setShowDeleteMenu(false),
        } as ComponentProps<typeof Marker>["eventHandlers"]
      }
    >
      {!showDeleteMenu ? (
        <Tooltip direction="top" offset={[0, -12]}>
          Vértice {index + 1} — segure para excluir
        </Tooltip>
      ) : null}
      {showDeleteMenu ? (
        <Popup
          offset={[0, -10]}
          className="dd-map-action-popup"
          closeButton
          autoPan
          keepInView
        >
          <div className="flex min-w-[12.5rem] max-w-[min(92vw,16rem)] flex-col">
            <div className="border-b border-white/[0.08] px-3 py-2.5 pr-9">
              <p className="text-sm font-semibold tracking-tight text-neutral-100">Vértice</p>
              <p className="mt-1 text-xs text-neutral-500">Vértice {index + 1} do polígono</p>
            </div>
            <div className="flex flex-col gap-0.5 p-2">
              {total > 3 ? (
                <button
                  ref={deleteBtnRef}
                  type="button"
                  className={cn(
                    "touch-target flex min-h-11 w-full items-center gap-2 rounded-lg border border-transparent px-3 text-left text-sm font-medium text-red-400 transition-colors duration-150",
                    "hover:border-red-500/25 hover:bg-red-500/10 active:bg-red-500/15",
                    deletePressed &&
                      "border-red-500/35 bg-red-500/16 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
                  )}
                  onClick={performVertexDelete}
                >
                  <Trash2 className="size-4 shrink-0 opacity-90" aria-hidden />
                  Deletar vértice
                </button>
              ) : (
                <p className="px-1 py-1.5 text-xs leading-snug text-neutral-400">
                  Polígono precisa de pelo menos 3 vértices.
                </p>
              )}
              <button
                type="button"
                className={cn(
                  "touch-target flex min-h-11 w-full items-center justify-center rounded-lg px-3 text-sm text-neutral-200 transition-colors",
                  "hover:bg-white/[0.06] active:bg-white/[0.08]",
                )}
                onClick={() => setShowDeleteMenu(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </Popup>
      ) : null}
    </Marker>
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
