import type { FeatureCollection, Polygon } from "geojson";
import { http } from "@/services/http";
import type { PersistedFlightPlan } from "@/features/flight-planner/stores/useFlightStore";
import type {
  CreateProjectData,
  FlightPlan,
  PreviewRunInfo,
  ProcessingRunInfo,
  Project,
  ProjectStatus,
} from "@/types/project";

type StartProcessingPayload = {
  preset?: "fast" | "standard" | "ultra";
  enable_preview?: boolean;
};

/** Corpo de POST /projects/:id/purge (snake_case, alinhado ao backend). */
export type ProjectPurgeRequestBody = {
  images: boolean;
  flight_plan: boolean;
  processing_results: boolean;
  preview_results: boolean;
  processing_runs: boolean;
  preview_runs: boolean;
  calibration_sessions: boolean;
};

export type ProcessingEnqueueResponse = {
  project_id: string;
  status: string;
  progress: number;
  assets: Record<string, string> | null;
  task_uuid: string | null;
  preview_status?: string | null;
  preview_progress?: number | null;
};

export type CalibrationSessionListItem = {
  id: string;
  project_id: string;
  status: string;
  created_at: string;
};

export type CalibrationExifMetric = {
  id: string;
  title: string;
  severity: "ok" | "warn" | "bad" | "info";
  detail: string;
  value?: number | string;
};

export type CalibrationParamChange = {
  field: string;
  suggested: number;
  current?: number | null;
  hint?: string | null;
};

export type CalibrationRecommendation = {
  id: string;
  kind: string;
  severity: "info" | "warn" | "bad" | string;
  rationale: string;
  text: string;
  param_changes: CalibrationParamChange[];
  /** IDs dos slots do grid relacionados a esta recomendação (Fase 5). */
  affected_slots: string[];
};

export type CalibrationExifReportPayload = {
  version?: number;
  summary?: Record<string, unknown>;
  metrics?: CalibrationExifMetric[];
  error?: string;
  calibration_grid?: { slot_counts?: Record<string, number> };
};

export type CalibrationSlotReport = {
  slot_id: string;
  row: number;
  col: number;
  best_image_id?: string | null;
  best_score?: number | null;
  blur_score?: number | null;
  clipping_ratio?: number | null;
  shadow_noise?: number | null;
  n_photos_covering?: number;
  feature_overlap_with_neighbors?: number | null;
  status?: string;
};

export type CalibrationPixelReportPayload = {
  version?: number;
  summary?: Record<string, unknown>;
  metrics?: CalibrationExifMetric[];
  per_image?: unknown[];
  pairwise_orb?: unknown[];
  slot_reports?: CalibrationSlotReport[];
  error?: string | null;
};

/** Slot da grade teórica (backend `theoretical_grid.slots`). */
export type CalibrationGridSlot = {
  id: string;
  row: number;
  col: number;
  center_lat: number;
  center_lon: number;
  footprint_polygon: Polygon;
  status:
    | "empty"
    | "covered"
    | "gap"
    | "warning"
    | "critical"
    | "best"
    | string;
  primary_image_id?: string | null;
  best_image_id?: string | null;
  best_score?: number | null;
  blur_score?: number | null;
  clipping_ratio?: number | null;
  shadow_noise?: number | null;
  n_photos_covering?: number;
  feature_overlap_with_neighbors?: number | null;
};

export type CalibrationImageSummary = {
  id: string;
  filename: string;
  primary_slot_id?: string | null;
  is_best_for_slot?: boolean | null;
  exif: Record<string, unknown>;
  extras: Record<string, unknown>;
};

export type CalibrationTheoreticalGrid = {
  version?: number;
  tolerance_m?: number;
  footprint_w_m?: number;
  footprint_h_m?: number;
  rotation_deg?: number;
  utm_epsg?: number | null;
  slots?: CalibrationGridSlot[];
  error?: string;
};

export type CalibrationSessionDetail = {
  id: string;
  project_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  polygon_snapshot?: Record<string, unknown> | null;
  exif_report: CalibrationExifReportPayload | null;
  pixel_report: CalibrationPixelReportPayload | null;
  theoretical_grid?: CalibrationTheoreticalGrid | null;
  recommendations?: CalibrationRecommendation[];
};

export type CalibrationSessionFullReport = {
  session_id: string;
  status: string;
  polygon_snapshot?: Record<string, unknown> | null;
  exif_report: CalibrationExifReportPayload | null;
  pixel_report: CalibrationPixelReportPayload | null;
  theoretical_grid?: CalibrationTheoreticalGrid | null;
  recommendations?: CalibrationRecommendation[];
};

type ApiProcessingRun = {
  run_id?: string;
  preset?: string;
  completed_at?: string;
  stats?: Record<string, unknown> | null;
  assets?: Record<string, string>;
};

type ApiPreviewRun = {
  run_id?: string;
  kind?: string;
  completed_at?: string;
  preview_assets?: Record<string, string>;
};

type ApiProject = {
  id: string;
  name: string;
  description: string;
  status: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  /** Snapshot completo do planejador (UI); persistido no backend. */
  planner_data?: unknown;
  images?: { id: string }[];
  assets?: Record<string, string> | null;
  stats?: Record<string, unknown> | null;
  preview_status?: string | null;
  preview_progress?: number;
  preview_assets?: Record<string, string> | null;
  processing_runs?: ApiProcessingRun[];
  preview_runs?: ApiPreviewRun[];
  last_processing_preset?: string | null;
  sparse_cloud_available?: boolean;
};

function mapProcessingRun(r: ApiProcessingRun): ProcessingRunInfo {
  return {
    runId: String(r.run_id ?? ""),
    preset: String(r.preset ?? ""),
    completedAt: String(r.completed_at ?? ""),
    stats: r.stats ?? null,
    assets: r.assets ?? {},
  };
}

function mapPreviewRun(r: ApiPreviewRun): PreviewRunInfo {
  return {
    runId: String(r.run_id ?? ""),
    kind: String(r.kind ?? ""),
    completedAt: String(r.completed_at ?? ""),
    previewAssets: r.preview_assets ?? {},
  };
}

function toFlightPlanFromApi(p: ApiProject): FlightPlan | null {
  if (p.planner_data == null) return null;
  return {
    id: `${p.id}-plan`,
    name: `Plano de ${p.name}`,
    plannerData: p.planner_data,
  };
}

function normalizeProject(p: ApiProject): Project {
  const processingRuns = Array.isArray(p.processing_runs)
    ? p.processing_runs.map(mapProcessingRun)
    : [];
  const previewRuns = Array.isArray(p.preview_runs) ? p.preview_runs.map(mapPreviewRun) : [];
  return {
    id: String(p.id),
    name: p.name,
    description: p.description ?? "",
    status: p.status as ProjectStatus,
    createdAt: p.createdAt ?? p.created_at ?? "",
    updatedAt: p.updatedAt ?? p.updated_at ?? "",
    imageCount: p.images?.length ?? 0,
    assets: p.assets ?? null,
    stats: p.stats ?? null,
    previewStatus: p.preview_status ?? null,
    previewProgress:
      typeof p.preview_progress === "number" ? p.preview_progress : 0,
    previewAssets: p.preview_assets ?? null,
    processingRuns,
    previewRuns,
    lastProcessingPreset: p.last_processing_preset ?? null,
    sparseCloudAvailable: Boolean(p.sparse_cloud_available),
    flightPlan: toFlightPlanFromApi(p),
  };
}

function toFlightPlanSaveBody(plan: PersistedFlightPlan) {
  const pr = plan.params;
  return {
    planner_data: plan as unknown as Record<string, unknown>,
    flight_area: plan.polygon ?? undefined,
    altitude_m: pr.altitudeM,
    forward_overlap: Math.round(pr.forwardOverlap),
    side_overlap: Math.round(pr.sideOverlap),
    rotation_angle: pr.rotationDeg,
    stats: plan.stats,
  };
}

export const projectsService = {
  async getAll(): Promise<Project[]> {
    const { data } = await http.get<ApiProject[]>("/projects");
    return data.map(normalizeProject);
  },

  async getById(id: string): Promise<Project> {
    const { data } = await http.get<ApiProject>(`/projects/${id}`);
    return normalizeProject(data);
  },

  async create(payload: CreateProjectData): Promise<Project> {
    const { data } = await http.post<ApiProject>("/projects", payload);
    return normalizeProject(data);
  },

  async update(id: string, payload: Partial<Project>): Promise<Project> {
    const { data } = await http.patch<ApiProject>(`/projects/${id}`, payload);
    return normalizeProject(data);
  },

  async saveFlightPlan(
    id: string,
    plan: PersistedFlightPlan,
  ): Promise<Project> {
    const { data } = await http.post<ApiProject>(
      `/projects/${id}/flightplan`,
      toFlightPlanSaveBody(plan),
    );
    return normalizeProject(data);
  },

  async remove(id: string): Promise<void> {
    await http.delete(`/projects/${id}`);
  },

  async startProcessing(
    id: string,
    payload: StartProcessingPayload = {},
  ): Promise<void> {
    await http.post(`/projects/${id}/process`, payload);
  },

  async finalizeProcessing(id: string): Promise<ProcessingEnqueueResponse> {
    const { data } = await http.post<ProcessingEnqueueResponse>(
      `/projects/${id}/finalize`,
    );
    return data;
  },

  async finalizePreviewProcessing(
    id: string,
  ): Promise<ProcessingEnqueueResponse> {
    const { data } = await http.post<ProcessingEnqueueResponse>(
      `/projects/${id}/finalize-preview`,
    );
    return data;
  },

  async listProjectImages(
    projectId: string,
  ): Promise<
    {
      id: string;
      filename: string;
      has_gps: boolean;
      lat: number | null;
      lon: number | null;
      created_at: string;
    }[]
  > {
    const { data } = await http.get<
      {
        id: string;
        filename: string;
        has_gps: boolean;
        lat: number | null;
        lon: number | null;
        created_at: string;
      }[]
    >(`/projects/${projectId}/images`);
    return data;
  },

  async deleteProjectImage(projectId: string, imageId: string): Promise<void> {
    await http.delete(`/projects/${projectId}/images/${imageId}`);
  },

  async cancelProcessing(id: string): Promise<void> {
    await http.delete(`/projects/${id}/process`);
  },

  async downloadAsset(projectId: string, assetKey: string): Promise<void> {
    const { data, headers } = await http.get<Blob>(
      `/projects/${projectId}/assets/${assetKey}/download`,
      {
        responseType: "blob",
      },
    );
    const contentDisposition = (headers as Record<string, string>)[
      "content-disposition"
    ];
    const filenameMatch = contentDisposition?.match(/filename="?([^";\n]+)"?/);
    const filename =
      filenameMatch?.[1] ?? assetKey.split("/").pop() ?? "download";
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
  },

  async resetUploadSession(
    projectId: string,
  ): Promise<{ deleted_images: number }> {
    const { data } = await http.post<{ deleted_images: number }>(
      `/projects/${projectId}/images/reset-upload-session`,
    );
    return data;
  },

  async purge(projectId: string, body: ProjectPurgeRequestBody): Promise<Project> {
    const { data } = await http.post<ApiProject>(`/projects/${projectId}/purge`, body);
    return normalizeProject(data);
  },

  async getProjectBounds(
    id: string,
  ): Promise<{
    west: number;
    south: number;
    east: number;
    north: number;
  } | null> {
    try {
      const { data } = await http.get<{
        west: number;
        south: number;
        east: number;
        north: number;
      }>(`/projects/${id}/bounds`);
      return data;
    } catch {
      return null;
    }
  },

  async getSparseCloudGeoJson(
    id: string,
    options?: { maxPoints?: number },
  ): Promise<GeoJSON.GeoJsonObject> {
    const q = new URLSearchParams();
    if (options?.maxPoints != null) {
      q.set("max_points", String(options.maxPoints));
    }
    const suffix = q.toString() ? `?${q.toString()}` : "";
    const { data } = await http.get<GeoJSON.GeoJsonObject>(
      `/projects/${id}/sparse-cloud${suffix}`,
      { timeout: 120_000 },
    );
    return data;
  },

  async getFlightPathGeoJson(id: string): Promise<FeatureCollection> {
    const { data } = await http.get<FeatureCollection>(
      `/projects/${id}/flight-path`,
    );
    return data;
  },

  getStatusStreamUrl(id: string): string {
    const apiBase = (
      import.meta.env.VITE_API_URL ?? "http://192.168.1.39:8000/api/v1"
    ).replace(/\/$/, "");
    const workspaceId = import.meta.env.VITE_WORKSPACE_ID ?? "default";
    const separator = apiBase.includes("?") ? "&" : "?";
    return `${apiBase}/projects/${id}/status/stream${separator}workspace_id=${encodeURIComponent(workspaceId)}`;
  },

  async createCalibrationSession(
    projectId: string,
    body: {
      params_snapshot: Record<string, unknown>;
      polygon_snapshot: Record<string, unknown>;
    },
  ): Promise<{
    session_id: string;
    upload_url: string;
    theoretical_grid?: CalibrationTheoreticalGrid | null;
  }> {
    const { data } = await http.post<{
      session_id: string;
      upload_url: string;
      theoretical_grid?: CalibrationTheoreticalGrid | null;
    }>(`/flight-plans/${projectId}/calibration-session`, body);
    return data;
  },

  async listCalibrationSessions(
    projectId: string,
  ): Promise<CalibrationSessionListItem[]> {
    const { data } = await http.get<CalibrationSessionListItem[]>(
      `/flight-plans/${projectId}/calibration-sessions`,
    );
    return data;
  },

  async deleteCalibrationSession(
    projectId: string,
    sessionId: string,
  ): Promise<void> {
    await http.delete(
      `/flight-plans/${projectId}/calibration-sessions/${sessionId}`,
    );
  },

  async getCalibrationSession(
    sessionId: string,
  ): Promise<CalibrationSessionDetail> {
    const { data } = await http.get<CalibrationSessionDetail>(
      `/calibration-sessions/${sessionId}`,
    );
    return data;
  },

  async getCalibrationSessionReport(
    sessionId: string,
  ): Promise<CalibrationSessionFullReport> {
    const { data } = await http.get<CalibrationSessionFullReport>(
      `/calibration-sessions/${sessionId}/report`,
    );
    return data;
  },

  async listCalibrationSessionImages(
    sessionId: string,
  ): Promise<CalibrationImageSummary[]> {
    const { data } = await http.get<CalibrationImageSummary[]>(
      `/calibration-sessions/${sessionId}/images`,
    );
    return data;
  },

  calibrationImageThumbnailUrl(sessionId: string, imageId: string): string {
    const base = (
      import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1"
    ).replace(/\/$/, "");
    return `${base}/calibration-sessions/${sessionId}/images/${imageId}/thumbnail`;
  },

  async uploadCalibrationImages(
    sessionId: string,
    files: File[],
    options: { consentProcessPersonalData: boolean; storeOriginal: boolean },
  ): Promise<{
    session_id: string;
    accepted: number;
    status: string;
    store_original: boolean;
    message?: string | null;
  }> {
    const body = new FormData();
    for (const f of files) {
      body.append("files", f);
    }
    body.append(
      "consent_process_personal_data",
      options.consentProcessPersonalData ? "true" : "false",
    );
    body.append("store_original", options.storeOriginal ? "true" : "false");
    const { data } = await http.post(
      `/calibration-sessions/${sessionId}/images`,
      body,
      {
        timeout: 120_000,
      },
    );
    return data;
  },
};
