import { useCallback } from "react";
import { Crosshair, Loader2, Minus, Plus, ScanSearch } from "lucide-react";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useResultsViewStore } from "@/features/results/stores/useResultsViewStore";
import { cn } from "@/lib/utils";
import type { Map3DElementInstance } from "@/features/map-engine/providers/google/GoogleMapsPhotorealisticPane";
import { zoomLevelToCameraRangeMeters } from "@/features/map-engine/providers/google/googleMapsZoomRange";

const LOCATE_ZOOM = 16;

const BTN =
  "touch-target flex h-12 w-12 items-center justify-center text-[#e8e8e8] transition hover:bg-white/10 active:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50";

type Props = {
  map: google.maps.Map | null;
  map3dElement: Map3DElementInstance | null;
  showResults: boolean;
};

function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Map3DElement mutates `center` / `range` as public API; keep outside component for compiler purity. */
function immersiveZoomIn(el: Map3DElementInstance) {
  const r = el.range;
  if (typeof r !== "number") return;
  el.range = Math.max(60, r * 0.75);
}

function immersiveZoomOut(el: Map3DElementInstance) {
  const r = el.range;
  if (typeof r !== "number") return;
  el.range = Math.min(900_000, r * 1.35);
}

function immersiveLocate(
  el: Map3DElementInstance,
  lat: number,
  lng: number,
  viewportHeightPx: number,
) {
  el.center = { lat, lng, altitude: 0 };
  el.range = zoomLevelToCameraRangeMeters(LOCATE_ZOOM, lat, viewportHeightPx);
}

function immersiveFitBounds(
  el: Map3DElementInstance,
  south: number,
  west: number,
  north: number,
  east: number,
) {
  const centerLat = (south + north) / 2;
  const centerLng = (west + east) / 2;
  const diag = haversineMeters(
    { lat: south, lng: west },
    { lat: north, lng: east },
  );
  el.center = { lat: centerLat, lng: centerLng, altitude: 0 };
  el.range = Math.min(900_000, Math.max(60, diag * 0.55));
}

export function GoogleMapsBottomLeft({
  map,
  map3dElement,
  showResults,
}: Props) {
  const { error, phase, locate } = useGeolocation();
  const autoFitBounds = useResultsViewStore((s) => s.autoFitBounds);

  const onZoomIn = useCallback(() => {
    if (map) {
      const z = map.getZoom() ?? 15;
      map.setZoom(z + 1);
      return;
    }
    if (map3dElement) immersiveZoomIn(map3dElement);
  }, [map, map3dElement]);

  const onZoomOut = useCallback(() => {
    if (map) {
      const z = map.getZoom() ?? 15;
      map.setZoom(z - 1);
      return;
    }
    if (map3dElement) immersiveZoomOut(map3dElement);
  }, [map, map3dElement]);

  const onLocate = useCallback(() => {
    if (map) {
      void locate().then((coords) => {
        const targetZoom = Math.max(map.getZoom() ?? LOCATE_ZOOM, LOCATE_ZOOM);
        map.panTo({ lat: coords.lat, lng: coords.lng });
        map.setZoom(targetZoom);
      });
      return;
    }
    const el = map3dElement;
    if (!el) return;
    void locate().then((coords) => {
      immersiveLocate(el, coords.lat, coords.lng, window.innerHeight);
    });
  }, [locate, map, map3dElement]);

  const onFitProject = useCallback(() => {
    if (!autoFitBounds) return;
    const [[south, west], [north, east]] = autoFitBounds;
    if (map) {
      const bounds = new google.maps.LatLngBounds(
        { lat: south, lng: west },
        { lat: north, lng: east },
      );
      map.fitBounds(bounds, 32);
      return;
    }
    if (map3dElement) immersiveFitBounds(map3dElement, south, west, north, east);
  }, [autoFitBounds, map, map3dElement]);

  const hasViewport = Boolean(map ?? map3dElement);

  return (
    <div
      className="pointer-events-none absolute z-10 flex flex-col gap-2"
      style={{
        left: "max(0.75rem, env(safe-area-inset-left, 0px))",
        bottom: "max(6rem, calc(0.75rem + var(--safe-area-bottom, 0px)))",
      }}
    >
      <div className="pointer-events-auto flex flex-col overflow-hidden rounded-xl border border-white/15 bg-[#121212]/90 shadow-lg backdrop-blur-md">
        <button
          type="button"
          className={cn(BTN, "border-b border-white/10")}
          onClick={onZoomIn}
          title="Aproximar"
        >
          <Plus className="size-5" />
        </button>
        <button
          type="button"
          className={BTN}
          onClick={onZoomOut}
          title="Afastar"
        >
          <Minus className="size-5" />
        </button>
      </div>

      <div className="pointer-events-auto flex flex-col items-stretch gap-2">
        {error ? (
          <p
            className="max-w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-red-500/30 bg-[#121212]/95 px-3 py-2 text-xs text-red-200 shadow-lg backdrop-blur-md"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <div
          className="flex flex-col overflow-hidden rounded-xl border border-white/15 bg-[#121212]/90 shadow-lg backdrop-blur-md"
          aria-live="polite"
        >
          {showResults && autoFitBounds ? (
            <>
              <button
                type="button"
                className={BTN}
                onClick={onFitProject}
                title="Ir para area do projeto"
                aria-label="Centralizar o mapa na area do projeto"
              >
                <ScanSearch className="size-5" aria-hidden />
              </button>
              <div className="mx-3 h-px bg-white/10" />
            </>
          ) : null}
          <button
            type="button"
            className={BTN}
            onClick={onLocate}
            disabled={phase === "loading" || !hasViewport}
            title="Minha localizacao"
            aria-label="Centralizar o mapa na minha localizacao"
          >
            {phase === "loading" ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : (
              <Crosshair className="size-5" aria-hidden />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
