import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import L from "leaflet";
import { PlannerMapBaseLayer } from "@/components/map/PlannerMapBaseLayer";
import {
  CircleMarker,
  GeoJSON,
  Polygon,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { MapBounds } from "@/features/results/stores/useResultsViewStore";
import { useMapEngine } from "@/features/map-engine/useMapEngine";
import { getSparseCloudMaxPoints } from "@/features/map-engine/utils/getSparseCloudMaxPoints";
import { useResultsViewStore } from "@/features/results/stores/useResultsViewStore";
import { lineStringCoordinates3d } from "@/features/map-engine/layers/RealFlightPathLayer";
import { projectHasFullOrthophoto } from "@/features/results/utils/orthophotoAssets";
import { PROJECT_DATA } from "@/lib/queryClient";
import { projectsService } from "@/services/projectsService";
import "leaflet/dist/leaflet.css";

function parseOrthoKey(key: string): {
  source: "full" | "preview";
  runId: string | null;
} {
  const idx = key.indexOf(":");
  if (idx < 0) return { source: "full", runId: null };
  const kind = key.slice(0, idx);
  const rest = key.slice(idx + 1);
  if (kind !== "full" && kind !== "preview")
    return { source: "full", runId: null };
  if (rest === "current") return { source: kind, runId: null };
  return { source: kind, runId: rest };
}

function orthophotoTileUrl(
  projectId: string,
  source: "full" | "preview",
  runId: string | null,
): string {
  const apiBase = (
    import.meta.env.VITE_API_URL ?? "http://192.168.1.39:8000/api/v1"
  ).replace(/\/$/, "");
  const params = new URLSearchParams();
  params.set("source", source);
  if (runId) params.set("run_id", runId);
  return `${apiBase}/projects/${projectId}/tiles/{z}/{x}/{y}.png?${params.toString()}`;
}

export function ResultsMapInnerLayers({
  projectId,
}: {
  projectId?: string | null;
}) {
  const activeLayer = useResultsViewStore((s) => s.activeLayer);
  const autoFitBounds = useResultsViewStore((s) => s.autoFitBounds);
  const orthophotoLayerVisibility = useResultsViewStore(
    (s) => s.orthophotoLayerVisibility,
  );
  const orthophotoLayerOpacity = useResultsViewStore(
    (s) => s.orthophotoLayerOpacity,
  );
  const ensureOrthophotoLayerKeys = useResultsViewStore(
    (s) => s.ensureOrthophotoLayerKeys,
  );
  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => projectsService.getById(projectId!),
    enabled: Boolean(projectId),
    ...PROJECT_DATA,
  });

  const { deviceTier, mode, provider } = useMapEngine();
  /** Nuvem esparsa pública neste painel: só 2D Leaflet (Mapbox/3D: sem essa layer aqui ainda). */
  const use3DCloudCap =
    (provider === "mapbox" || provider === "google") && mode === "3d";
  const sparseMax = getSparseCloudMaxPoints(deviceTier, use3DCloudCap);

  const sparseUnlocked = Boolean(project?.sparseCloudAvailable);
  const { data: sparseGeoJson } = useQuery({
    queryKey: ["sparse-cloud", projectId, sparseMax, use3DCloudCap],
    queryFn: () =>
      projectsService.getSparseCloudGeoJson(projectId!, {
        maxPoints: sparseMax,
      }),
    enabled: Boolean(projectId && sparseUnlocked),
    staleTime: 60_000,
  });
  const orthoKeys = useMemo(() => {
    if (!project) return [];
    const keys: string[] = [];
    if (projectHasFullOrthophoto(project)) keys.push("full:current");
    for (const r of project.processingRuns) keys.push(`full:${r.runId}`);
    if (project.previewAssets && project.previewStatus === "completed")
      keys.push("preview:current");
    for (const r of project.previewRuns) keys.push(`preview:${r.runId}`);
    return keys;
  }, [project]);
  useEffect(() => {
    ensureOrthophotoLayerKeys(orthoKeys);
  }, [orthoKeys, ensureOrthophotoLayerKeys]);
  const visibleOrthoKeys = useMemo(
    () => orthoKeys.filter((k) => orthophotoLayerVisibility[k] !== false),
    [orthoKeys, orthophotoLayerVisibility],
  );
  const orderedOrthoKeys = useMemo(
    () =>
      [...visibleOrthoKeys].sort((a, b) => {
        const pa = a.startsWith("preview") ? 0 : 1;
        const pb = b.startsWith("preview") ? 0 : 1;
        return pa - pb;
      }),
    [visibleOrthoKeys],
  );
  const globalLayerOpacity = useResultsViewStore((s) => s.opacity);
  const tool = useResultsViewStore((s) => s.tool);
  const distancePoints = useResultsViewStore((s) => s.distancePoints);
  const areaPoints = useResultsViewStore((s) => s.areaPoints);
  const elevationPoint = useResultsViewStore((s) => s.elevationPoint);
  const boundaryPoints = useResultsViewStore((s) => s.boundaryPoints);
  const addDistancePoint = useResultsViewStore((s) => s.addDistancePoint);
  const addAreaPoint = useResultsViewStore((s) => s.addAreaPoint);
  const setElevationPoint = useResultsViewStore((s) => s.setElevationPoint);
  const addBoundaryPoint = useResultsViewStore((s) => s.addBoundaryPoint);
  const showRealFlightPath = useResultsViewStore((s) => s.showRealFlightPath);
  const { data: flightPathGeo } = useQuery({
    queryKey: ["project-flight-path", projectId],
    queryFn: () => projectsService.getFlightPathGeoJson(projectId!),
    enabled: Boolean(projectId && showRealFlightPath),
    retry: false,
  });

  const hasDsm = Boolean(project?.assets?.["odm_dem/dsm.tif"]);
  const hasDtm = Boolean(project?.assets?.["odm_dem/dtm.tif"]);
  const hasContours = Boolean(project?.assets?.["contours"]);

  const { data: contoursGeoJson } = useQuery({
    queryKey: ["project-contours", projectId],
    queryFn: () => projectsService.getContoursGeoJson(projectId!),
    enabled: Boolean(projectId) && activeLayer === "contours" && hasContours,
    staleTime: 300_000,
    retry: false,
  });
  const realPathLatLng = useMemo(() => {
    if (!flightPathGeo) return [] as [number, number][];
    return lineStringCoordinates3d(flightPathGeo).map(
      ([lng, lat]) => [lat, lng] as [number, number],
    );
  }, [flightPathGeo]);

  return (
    <>
      <PlannerMapBaseLayer />
      {activeLayer === "orthophoto" && projectId && orderedOrthoKeys.length > 0
        ? orderedOrthoKeys.map((key) => {
            const { source, runId } = parseOrthoKey(key);
            const layerOpacity = (orthophotoLayerOpacity[key] ?? 85) / 100;
            return (
              <TileLayer
                key={key}
                url={orthophotoTileUrl(projectId, source, runId)}
                opacity={layerOpacity}
                maxNativeZoom={22}
                maxZoom={24}
                tileSize={256}
                attribution="DroneData"
              />
            );
          })
        : null}
      {activeLayer === "dsm" && projectId && hasDsm ? (
        <TileLayer
          key={`dsm-${projectId}`}
          url={projectsService.getDsmTileUrl(projectId)}
          opacity={globalLayerOpacity / 100}
          maxNativeZoom={22}
          maxZoom={24}
          tileSize={256}
          attribution="DroneData DSM"
        />
      ) : null}
      {activeLayer === "dtm" && projectId && hasDtm ? (
        <TileLayer
          key={`dtm-${projectId}`}
          url={projectsService.getDtmTileUrl(projectId)}
          opacity={globalLayerOpacity / 100}
          maxNativeZoom={22}
          maxZoom={24}
          tileSize={256}
          attribution="DroneData DTM"
        />
      ) : null}
      {activeLayer === "contours" && contoursGeoJson ? (
        <GeoJSON
          key="contours"
          data={contoursGeoJson}
          style={() => ({
            color: "#7dd3fc",
            weight: 1,
            opacity: globalLayerOpacity / 100,
          })}
          onEachFeature={(feature, layer) => {
            const e = feature.properties?.elev ?? feature.properties?.elevation;
            if (e != null) layer.bindTooltip(`${Number(e).toFixed(1)} m`);
          }}
        />
      ) : null}
      {showRealFlightPath && realPathLatLng.length >= 2 ? (
        <Polyline
          positions={realPathLatLng}
          pathOptions={{ color: "#06b6d4", weight: 3, opacity: 0.92 }}
        />
      ) : null}
      {activeLayer === "sparse" && sparseGeoJson ? (
        <GeoJSON
          key="sparse-cloud"
          data={sparseGeoJson}
          pointToLayer={(feature, latlng) => {
            const rgb = feature.properties?.color as number[] | undefined;
            const fill =
              Array.isArray(rgb) && rgb.length >= 3
                ? `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`
                : "#94a3b8";
            const layerOpacity = globalLayerOpacity / 100;
            return L.circleMarker(latlng, {
              radius: 2,
              stroke: true,
              weight: 0.5,
              color: "#0f172a",
              opacity: 0.5 * layerOpacity,
              fillColor: fill,
              fillOpacity: 0.85 * layerOpacity,
            });
          }}
        />
      ) : null}

      {distancePoints.length > 1 ? (
        <Polyline
          positions={distancePoints}
          pathOptions={{ color: "#22d3ee", weight: 2 }}
        />
      ) : null}
      {areaPoints.length > 2 ? (
        <Polygon
          positions={areaPoints}
          pathOptions={{
            color: "#60a5fa",
            dashArray: "4 4",
            fillOpacity: 0.25,
          }}
        />
      ) : null}
      {distancePoints.map((point, index) => (
        <CircleMarker
          key={`d-${String(index)}`}
          center={point}
          radius={4}
          pathOptions={{ color: "#22d3ee" }}
        />
      ))}
      {areaPoints.map((point, index) => (
        <CircleMarker
          key={`a-${String(index)}`}
          center={point}
          radius={4}
          pathOptions={{ color: "#60a5fa" }}
        />
      ))}
      {elevationPoint ? (
        <CircleMarker
          center={elevationPoint}
          radius={5}
          pathOptions={{ color: "#fbbf24" }}
        />
      ) : null}

      {boundaryPoints.length > 2 ? (
        <Polygon
          positions={boundaryPoints}
          pathOptions={{
            color: "#f97316",
            weight: 2,
            dashArray: "6 3",
            fillColor: "#f97316",
            fillOpacity: 0.12,
          }}
        />
      ) : null}
      {boundaryPoints.map((point, index) => (
        <CircleMarker
          key={`b-${String(index)}`}
          center={point}
          radius={4}
          pathOptions={{
            color: "#f97316",
            fillColor: "#f97316",
            fillOpacity: 1,
          }}
        />
      ))}

      <AutoFitBoundsEffect bounds={autoFitBounds} />
      <MapToolEvents
        tool={tool}
        onAddDistance={addDistancePoint}
        onAddArea={addAreaPoint}
        onPickElevation={setElevationPoint}
        onAddBoundary={addBoundaryPoint}
      />
    </>
  );
}

function AutoFitBoundsEffect({ bounds }: { bounds: MapBounds | null }) {
  const map = useMap();
  const lastBoundsRef = useRef<MapBounds | null>(null);

  useEffect(() => {
    if (!bounds) return;
    // Only fit when bounds actually change (avoid re-fitting on every render)
    const prev = lastBoundsRef.current;
    const changed =
      !prev ||
      prev[0][0] !== bounds[0][0] ||
      prev[0][1] !== bounds[0][1] ||
      prev[1][0] !== bounds[1][0] ||
      prev[1][1] !== bounds[1][1];
    if (!changed) return;
    lastBoundsRef.current = bounds;
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 20 });
  }, [bounds, map]);

  return null;
}

function MapToolEvents({
  tool,
  onAddDistance,
  onAddArea,
  onPickElevation,
  onAddBoundary,
}: {
  tool: "none" | "distance" | "area" | "elevation" | "boundary";
  onAddDistance: (p: [number, number]) => void;
  onAddArea: (p: [number, number]) => void;
  onPickElevation: (p: [number, number] | null) => void;
  onAddBoundary: (p: [number, number]) => void;
}) {
  useMapEvents({
    click(event) {
      const point: [number, number] = [event.latlng.lat, event.latlng.lng];
      if (tool === "distance") onAddDistance(point);
      if (tool === "area") onAddArea(point);
      if (tool === "elevation") onPickElevation(point);
      if (tool === "boundary") onAddBoundary(point);
    },
    contextmenu(event) {
      event.originalEvent.preventDefault();
    },
  });
  return null;
}
