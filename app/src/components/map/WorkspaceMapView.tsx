import { lazy, Suspense, type ReactNode } from "react";
import type { WorkspacePanelId } from "@/constants/routes";
import type { WorkspaceMapWeatherTilesProps } from "@/components/map/useWorkspaceMapWeather";
import { useMapEngine } from "@/features/map-engine";

const MapboxMapView = lazy(async () => {
  const m =
    await import("@/features/map-engine/providers/mapbox/MapboxMapView");
  return { default: m.MapboxMapView };
});

const GoogleMapsView = lazy(async () => {
  const m =
    await import("@/features/map-engine/providers/google/GoogleMapsView");
  return { default: m.GoogleMapsView };
});

const LeafletMapView = lazy(async () => {
  const m =
    await import("@/features/map-engine/providers/leaflet/LeafletMapView");
  return { default: m.LeafletMapView };
});

function MapLoadingFallback() {
  return (
    <div className="absolute inset-0 z-0 flex flex-col items-center justify-center gap-2 bg-[#0f0f0f] px-6 text-center">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
      <p className="text-sm font-medium text-neutral-200">
        Carregando mapa 3D…
      </p>
    </div>
  );
}

type WorkspaceMapViewProps = {
  panel: WorkspacePanelId;
  projectId: string | null;
  weatherTiles: WorkspaceMapWeatherTilesProps;
};

function LazyWrapper({ children }: { children: ReactNode }) {
  return <Suspense fallback={<MapLoadingFallback />}>{children}</Suspense>;
}

export function WorkspaceMapView({
  panel,
  projectId,
  weatherTiles,
}: WorkspaceMapViewProps) {
  const { provider } = useMapEngine();

  if (provider === "mapbox") {
    return (
      <LazyWrapper>
        <MapboxMapView
          panel={panel}
          projectId={projectId}
          weatherTiles={weatherTiles}
        />
      </LazyWrapper>
    );
  }
  if (provider === "google") {
    return (
      <LazyWrapper>
        <GoogleMapsView
          panel={panel}
          projectId={projectId}
          weatherTiles={weatherTiles}
        />
      </LazyWrapper>
    );
  }
  return (
    <LazyWrapper>
      <LeafletMapView
        panel={panel}
        projectId={projectId}
        weatherTiles={weatherTiles}
      />
    </LazyWrapper>
  );
}
