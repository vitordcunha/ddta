import {
  type ReactNode,
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import centerOfMass from "@turf/center-of-mass";
import { motion, AnimatePresence } from "framer-motion";
import {
  Battery,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Cloud,
  CloudRain,
  Compass,
  Download,
  Droplets,
  Focus,
  Gauge,
  Info,
  Loader2,
  Maximize2,
  Mountain,
  Navigation,
  PenLine,
  Ruler,
  Sun,
  Thermometer,
  Trash2,
  TriangleAlert,
  Wind,
  Zap,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  Switch,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  readUserPreferencesFromStorage,
  USER_PREFERENCES_UPDATED_EVENT,
} from "@/constants/userPreferences";
import { DroneIllustration } from "@/features/flight-planner/components/DroneIllustration";
import { DronePicker } from "@/features/flight-planner/components/DronePicker";
import { useDroneModelsQuery } from "@/features/flight-planner/hooks/useDroneModelsQuery";
import { getDroneSpec } from "@/features/flight-planner/utils/droneSpecs";
import {
  profileToCalibrationSnapshotFields,
  profileToDroneSpec,
  resolveFlightDroneProfile,
} from "@/features/flight-planner/utils/flightDroneProfile";
import { CalibrationUploadDialog } from "@/features/flight-planner/components/CalibrationUploadDialog";
import { PreFlightChecklistModal } from "@/features/flight-planner/components/PreFlightChecklistModal";
import { useKmzExport } from "@/features/flight-planner/hooks/useKmzExport";
import { usePlatform } from "@/hooks/usePlatform";
import { KmzTransferNative } from "@/features/flight-planner/components/KmzTransferNative";
import { generateKmz } from "@/features/flight-planner/utils/kmzBuilder";
import { buildCalibrationMission } from "@/features/flight-planner/utils/calibrationPlan";
import { useWeather } from "@/features/flight-planner/hooks/useWeather";
import {
  buildSolarFlightContextLines,
  computeSolarFlightWindowSectionRisk,
  type PlannerSectionRisk,
} from "@/features/flight-planner/utils/solarPosition";
import {
  isWeatherUnavailableCopy,
  windDegToCompass,
  wmoCodeToConditionPt,
} from "@/features/flight-planner/utils/weatherHelpers";
import { useFlightStore } from "@/features/flight-planner/stores/useFlightStore";
import type { PersistedFlightPlan } from "@/features/flight-planner/stores/useFlightStore";
import {
  clearFlightPlanDraft,
  readFlightPlanDraft,
  shouldSessionSkipHydrateFromSavedPlan,
  writeFlightPlanDraft,
} from "@/features/flight-planner/utils/flightPlanDraftStorage";
import {
  readPreFlightKmzModalSkip,
  writePreFlightKmzModalSkip,
} from "@/features/flight-planner/utils/preFlightChecklistStorage";
import {
  projectsService,
  type CalibrationSessionListItem,
} from "@/services/projectsService";
import {
  analyzeFlightConfiguration,
  detectActiveQualityPreset,
  estimateGsdCmFromParams,
  estimatePrecision,
  FLIGHT_QUALITY_PRESETS,
  presetParamsFor,
} from "@/features/flight-planner/utils/flightParamGuidance";
import type { FlightQualityPresetId } from "@/features/flight-planner/utils/flightParamGuidance";
import { FlightQualityScoreBadge } from "@/features/flight-planner/components/FlightQualityScoreBadge";
import { MissionSummaryBar } from "@/features/flight-planner/components/MissionSummaryBar";
import {
  FlightPlannerExpandedModal,
  type PlannerExpandedTabId,
} from "@/features/flight-planner/components/FlightPlannerExpandedModal";
import { useCalibrationSession } from "@/features/flight-planner/hooks/useCalibrationSession";
import { useMapEngine } from "@/features/map-engine/useMapEngine";
import { MapRouteDeckVisibilityToggles } from "@/features/map-engine/components/MapRouteDeckVisibilityToggles";
import { Range } from "@/features/flight-planner/components/panels/FlightPlannerRangeInput";
import {
  formatForecastHourLabel,
  SolarArc,
  SolarArcEmpty,
  Stat,
  WeatherHero,
} from "@/features/flight-planner/components/panels/FlightPlannerWeatherWidgets";
import { flightPlannerFormat } from "@/features/flight-planner/utils/flightPlannerFormat";
import {
  configStickyBarClass,
  glassCardClass,
  useDeviceTier,
} from "@/lib/deviceUtils";

export type FlightPlannerShellProps = {
  expandedOpen: boolean;
  onExpandedOpenChange: (open: boolean) => void;
  expandedTab: PlannerExpandedTabId;
  onExpandedTabChange: (tab: PlannerExpandedTabId) => void;
};

type Props = {
  projectName: string;
  projectId: string;
  initialPlan: PersistedFlightPlan | null;
  onSavePlan: (plan: PersistedFlightPlan) => void | Promise<void>;
  plannerShell: FlightPlannerShellProps;
};

const format = flightPlannerFormat;

function PlannerCollapsibleCard({
  title,
  startsExpanded,
  riskLevel,
  leadingIcon,
  children,
}: {
  title: string;
  startsExpanded: boolean;
  riskLevel: PlannerSectionRisk;
  leadingIcon?: ReactNode;
  children: ReactNode;
}) {
  const deviceTier = useDeviceTier();
  const baseGlassCard = useMemo(
    () => glassCardClass(deviceTier),
    [deviceTier],
  );
  const [open, setOpen] = useState(startsExpanded);
  useLayoutEffect(() => {
    if (riskLevel === "danger") setOpen(true);
  }, [riskLevel]);
  return (
    <Card className={cn(baseGlassCard, "overflow-hidden p-0")}>
      <button
        type="button"
        className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-white/[0.04]"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-neutral-500 transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden
        />
        {leadingIcon ? (
          <span className="shrink-0 text-neutral-400 [&_svg]:size-4">
            {leadingIcon}
          </span>
        ) : null}
        <span className="min-w-0 flex-1 text-sm font-medium text-neutral-200">
          {title}
        </span>
        {riskLevel !== "none" ? (
          <TriangleAlert
            className={cn(
              "size-3.5 shrink-0",
              riskLevel === "danger" ? "text-red-400" : "text-amber-400",
            )}
            aria-label={riskLevel === "danger" ? "Risco" : "Aviso"}
          />
        ) : null}
      </button>
      {open ? (
        <div className="space-y-3 border-t border-white/[0.08] px-4 pb-4 pt-3">
          {children}
        </div>
      ) : null}
    </Card>
  );
}

export function FlightPlannerConfigPanel({
  projectName,
  projectId,
  initialPlan,
  onSavePlan,
  plannerShell,
}: Props) {
  const {
    expandedOpen: expandedPlannerOpen,
    onExpandedOpenChange: setExpandedPlannerOpen,
    expandedTab: expandedPlannerTab,
    onExpandedTabChange: setExpandedPlannerTab,
  } = plannerShell;
  const deviceTier = useDeviceTier();
  const glassCard = useMemo(
    () => glassCardClass(deviceTier),
    [deviceTier],
  );
  const {
    polygon,
    params,
    waypoints,
    stats,
    weather,
    assessment,
    isCalculating,
    poi,
    terrainFollowing,
    isTerrainLoading,
    setParams,
    setWeather,
    loadPlan,
    resetPlan,
    routeStartRef,
    plannerBaseLayer,
    calibrationSessionId,
    setCalibrationSessionId,
    calibrationMapPreviewActive,
    setCalibrationMapPreviewActive,
    setPlannerInteractionMode,
    setTerrainFollowing,
    setPoi,
    setPoiPlacementActive,
  } = useFlightStore();
  const { mapboxToken } = useMapEngine();
  const hasMapboxKey = mapboxToken.trim().length > 0;
  const {
    data: droneCatalog,
    isLoading: droneModelsLoading,
    isError: droneModelsError,
  } = useDroneModelsQuery();
  const resolvedDroneProfile = useMemo(
    () => resolveFlightDroneProfile(params, droneCatalog),
    [params.droneModel, params.droneModelId, droneCatalog],
  );
  const weatherSpec = useMemo(
    () => ({ maxSpeedMs: resolvedDroneProfile.maxSpeedMs }),
    [resolvedDroneProfile.maxSpeedMs],
  );
  const weatherQuery = useWeather(weatherSpec, params.altitudeM);
  const kmzExport = useKmzExport(projectName);
  const kmzCalibExport = useKmzExport(projectName);
  const platform = usePlatform();
  const [nativeKmzOpen, setNativeKmzOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preFlightOpen, setPreFlightOpen] = useState(false);
  const [preFlightKey, setPreFlightKey] = useState(0);
  const [preFlightFlow, setPreFlightFlow] = useState<"mission" | "calibration">(
    "mission",
  );
  const [, bumpKmzStorageRead] = useState(0);
  const skipKmzPreFlight = readPreFlightKmzModalSkip(projectId);
  const [calibrationSessions, setCalibrationSessions] = useState<
    CalibrationSessionListItem[]
  >([]);
  const [calibrationUploadOpen, setCalibrationUploadOpen] = useState(false);
  const [
    calibrationSessionPendingDeleteId,
    setCalibrationSessionPendingDeleteId,
  ] = useState<string | null>(null);
  const [deletingCalibrationSessionId, setDeletingCalibrationSessionId] =
    useState<string | null>(null);
  const [dronePickerOpen, setDronePickerOpen] = useState(false);
  const [userPrefRevision, setUserPrefRevision] = useState(0);
  useEffect(() => {
    const on = () => setUserPrefRevision((n) => n + 1);
    window.addEventListener(USER_PREFERENCES_UPDATED_EVENT, on);
    return () => window.removeEventListener(USER_PREFERENCES_UPDATED_EVENT, on);
  }, []);
  const [calibrationSessionRevision, setCalibrationSessionRevision] =
    useState(0);
  const { session: activeCalibrationSession } = useCalibrationSession(
    calibrationSessionId,
    Boolean(calibrationSessionId),
    calibrationSessionRevision,
  );

  // Snapshot dos params no momento em que a sessao de calibracao foi vinculada.
  // Usado para detectar se params criticos mudaram desde a calibracao.
  const calibrationParamsSnapshotRef = useRef<Pick<
    typeof params,
    "altitudeM" | "forwardOverlap" | "sideOverlap"
  > | null>(null);
  useEffect(() => {
    if (calibrationSessionId) {
      calibrationParamsSnapshotRef.current = {
        altitudeM: params.altitudeM,
        forwardOverlap: params.forwardOverlap,
        sideOverlap: params.sideOverlap,
      };
    } else {
      calibrationParamsSnapshotRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calibrationSessionId]);

  const calibrationOutdated = useMemo(() => {
    const snap = calibrationParamsSnapshotRef.current;
    if (!snap || !calibrationSessionId) return false;
    const altDiff = Math.abs(params.altitudeM - snap.altitudeM);
    const fwdDiff = Math.abs(params.forwardOverlap - snap.forwardOverlap);
    const sideDiff = Math.abs(params.sideOverlap - snap.sideOverlap);
    return altDiff > 10 || fwdDiff > 5 || sideDiff > 5;
  }, [
    calibrationSessionId,
    params.altitudeM,
    params.forwardOverlap,
    params.sideOverlap,
  ]);

  const [solarNow, setSolarNow] = useState(() => new Date());

  const loadCalibrationSessions = useCallback(async () => {
    try {
      const rows = await projectsService.listCalibrationSessions(projectId);
      setCalibrationSessions(rows);
    } catch {
      setCalibrationSessions([]);
    }
  }, [projectId]);

  const confirmDeleteCalibrationSession = useCallback(async () => {
    const id = calibrationSessionPendingDeleteId;
    if (!id) return;
    setDeletingCalibrationSessionId(id);
    try {
      await projectsService.deleteCalibrationSession(projectId, id);
      if (calibrationSessionId === id) {
        setCalibrationSessionId(null);
        setCalibrationSessionRevision((n) => n + 1);
      }
      setCalibrationSessions((prev) => prev.filter((row) => row.id !== id));
      toast.success("Sessão removida.");
    } catch {
      toast.error("Não foi possível remover a sessão.");
    } finally {
      setDeletingCalibrationSessionId(null);
      setCalibrationSessionPendingDeleteId(null);
    }
  }, [
    calibrationSessionId,
    calibrationSessionPendingDeleteId,
    projectId,
    setCalibrationSessionId,
  ]);

  useEffect(() => {
    void loadCalibrationSessions();
  }, [loadCalibrationSessions]);
  const {
    fetchWeather,
    weather: currentWeather,
    assessment: currentAssessment,
    isLoading: isWeatherLoading,
    error: weatherError,
  } = weatherQuery;

  useEffect(() => {
    startTransition(() => {
      const fromDraft = readFlightPlanDraft(projectId);
      if (fromDraft) {
        loadPlan(fromDraft);
        return;
      }
      if (shouldSessionSkipHydrateFromSavedPlan(projectId)) {
        // Descartou o plano local: não puxar o snapshot salvo no projeto (mantém Zustand).
        return;
      }
      if (initialPlan) {
        loadPlan(initialPlan);
      } else {
        resetPlan();
      }
    });
  }, [projectId, initialPlan, loadPlan, resetPlan]);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const sub = useFlightStore.subscribe((state) => {
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        if (!state.polygon && state.waypoints.length === 0) {
          clearFlightPlanDraft(projectId);
          return;
        }
        writeFlightPlanDraft(projectId, {
          polygon: state.polygon,
          params: state.params,
          waypoints: state.waypoints,
          stats: state.stats,
          weather: state.weather,
          assessment: state.assessment,
          calibrationSessionId: state.calibrationSessionId,
          terrainFollowing: state.terrainFollowing,
          poi: state.poi,
        });
      }, 300);
    });
    return () => {
      if (t) clearTimeout(t);
      sub();
    };
  }, [projectId]);

  const polygonCenter = useMemo(() => {
    if (!polygon) return null;
    const c = centerOfMass(polygon).geometry.coordinates;
    return { lat: c[1], lon: c[0] };
  }, [polygon]);

  useEffect(() => {
    if (!polygonCenter) return;
    setSolarNow(new Date());
    const id = window.setInterval(() => setSolarNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, [polygonCenter?.lat, polygonCenter?.lon]);

  const calibrationMission = useMemo(() => {
    if (!polygon) return null;
    return buildCalibrationMission(polygon, params, routeStartRef);
  }, [polygon, params, routeStartRef]);

  const solarPanelLines = useMemo(() => {
    if (!polygonCenter) return null;
    return buildSolarFlightContextLines({
      lat: polygonCenter.lat,
      lon: polygonCenter.lon,
      now: solarNow,
      weather: currentWeather,
      droneModel: params.droneModel,
    });
  }, [polygonCenter, currentWeather, params.droneModel, solarNow]);

  const solarSectionRisk = useMemo((): PlannerSectionRisk => {
    if (!polygonCenter) return "none";
    return computeSolarFlightWindowSectionRisk({
      lat: polygonCenter.lat,
      lon: polygonCenter.lon,
      now: solarNow,
      weather: currentWeather,
      droneModel: params.droneModel,
    });
  }, [polygonCenter, solarNow, currentWeather, params.droneModel]);

  const weatherSectionRisk = useMemo((): PlannerSectionRisk => {
    if (isWeatherLoading) return "none";
    if (currentAssessment && !currentAssessment.go) return "danger";
    if (currentAssessment?.issues?.length) return "danger";
    if (weatherError && !isWeatherUnavailableCopy(weatherError))
      return "danger";
    if (weatherError && isWeatherUnavailableCopy(weatherError))
      return "warning";
    if (currentAssessment?.warnings?.length) return "warning";
    return "none";
  }, [isWeatherLoading, currentAssessment, weatherError]);

  useEffect(() => {
    if (!polygon) return;
    const center = centerOfMass(polygon).geometry.coordinates;
    void fetchWeather(center[1], center[0]);
  }, [fetchWeather, polygon]);

  useEffect(() => {
    setWeather(currentWeather, currentAssessment);
  }, [currentAssessment, currentWeather, setWeather]);

  useEffect(() => {
    if (!droneCatalog?.length || !params.droneModelId) return;
    const ok = droneCatalog.some((m) => m.id === params.droneModelId);
    if (!ok) {
      setParams({ droneModelId: null });
    }
  }, [droneCatalog, params.droneModelId, setParams]);

  useEffect(() => {
    if (!droneCatalog?.length || params.droneModelId) return;
    const named = droneCatalog.find((m) => m.name === params.droneModel);
    const prefs = readUserPreferencesFromStorage();
    const fromUserDefault =
      prefs.defaultDroneModelId != null
        ? droneCatalog.find((m) => m.id === prefs.defaultDroneModelId)
        : undefined;
    const apiFallback =
      droneCatalog.find((m) => m.is_default) ?? droneCatalog[0];
    const fallback = fromUserDefault ?? apiFallback;
    const pick = named ?? fallback;
    if (pick) {
      setParams({ droneModelId: pick.id, droneModel: pick.name });
    }
  }, [
    droneCatalog,
    params.droneModelId,
    params.droneModel,
    setParams,
    userPrefRevision,
  ]);

  const calibrationOpticsSnapshot = useMemo(
    () =>
      profileToCalibrationSnapshotFields(
        resolveFlightDroneProfile(params, droneCatalog),
      ),
    [params.droneModel, params.droneModelId, droneCatalog],
  );

  const hasPlan = Boolean(polygon && waypoints.length > 0 && stats);

  const activeQualityPreset = useMemo(
    () => detectActiveQualityPreset(params),
    [params],
  );

  const configNotices = useMemo(
    () =>
      analyzeFlightConfiguration(
        params,
        stats
          ? { gsdCm: stats.gsdCm, estimatedPhotos: stats.estimatedPhotos }
          : null,
        droneCatalog,
      ),
    [params, stats, droneCatalog],
  );

  const applyQualityPreset = (id: FlightQualityPresetId) => {
    setParams(presetParamsFor(id));
  };

  const onRequestKmzDownload = () => {
    if (skipKmzPreFlight) {
      void kmzExport.generateAndDownload(waypoints, params, { poi });
    } else {
      setPreFlightFlow("mission");
      setPreFlightKey((k) => k + 1);
      setPreFlightOpen(true);
    }
  };

  const buildFlightKmzArrayBuffer = useCallback(async () => {
    const blob = await generateKmz(waypoints, { projectName, params, poi });
    return await blob.arrayBuffer();
  }, [params, poi, projectName, waypoints]);

  const saveCurrentPlan = async () => {
    if (saving) return;
    const plan: PersistedFlightPlan = {
      polygon,
      params,
      waypoints,
      stats,
      weather,
      assessment,
      calibrationSessionId,
      terrainFollowing,
      poi,
    };
    setSaving(true);
    try {
      await Promise.resolve(onSavePlan(plan));
    } finally {
      setSaving(false);
    }
  };

  const droneSpec = useMemo(() => {
    const base = profileToDroneSpec(resolvedDroneProfile);
    const leg = getDroneSpec(params.droneModel);
    return { ...base, ...(leg.image ? { image: leg.image } : {}) };
  }, [resolvedDroneProfile, params.droneModel]);

  return (
    <div className="space-y-3">
      {/* Drone card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={params.droneModelId ?? params.droneModel}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
        >
          <Card className={cn(glassCard, "overflow-hidden p-0")}>
            <button
              type="button"
              className="group flex w-full flex-col text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-500/55 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
              onClick={() => setDronePickerOpen(true)}
            >
              <div className="relative flex items-center gap-4 px-4 py-3">
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary-500/[0.07] via-transparent to-transparent" />
                <div className="relative shrink-0">
                  <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-white/[0.04] ring-1 ring-white/[0.08]">
                    {droneSpec.image ? (
                      <img
                        src={droneSpec.image}
                        alt=""
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <DroneIllustration model={params.droneModel} />
                    )}
                  </div>
                </div>
                <div className="relative min-w-0 flex-1 space-y-2">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
                      Drone selecionado
                    </p>
                    <h2 className="text-base font-semibold tracking-tight text-white">
                      {params.droneModel}
                    </h2>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                    <span className="flex items-center gap-1 text-neutral-400">
                      <Battery className="size-3 text-primary-400/80" />
                      <span className="text-neutral-200">
                        {droneSpec.batteryTimeMin} min
                      </span>
                    </span>
                    <span className="flex items-center gap-1 text-neutral-400">
                      <Zap className="size-3 text-amber-400/80" />
                      <span className="text-neutral-200">
                        {droneSpec.maxSpeedMs} m/s máx
                      </span>
                    </span>
                    <span className="flex items-center gap-1 text-neutral-400">
                      <Camera className="size-3 text-sky-400/80" />
                      <span className="text-neutral-200">
                        {(
                          (droneSpec.imageWidthPx * droneSpec.imageHeightPx) /
                          1_000_000
                        ).toFixed(0)}{" "}
                        MP
                      </span>
                    </span>
                    <span className="flex items-center gap-1 text-neutral-400">
                      <Focus className="size-3 text-violet-400/80" />
                      <span className="text-neutral-200">
                        {droneSpec.focalLengthMm} mm
                      </span>
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex min-h-11 w-full items-center justify-center gap-1 border-t border-white/[0.08] bg-white/[0.02] px-4 py-2.5 text-sm font-medium text-primary-300/95 group-hover:bg-white/[0.05]">
                Trocar drone
                <ChevronRight
                  className="size-4 shrink-0 opacity-80"
                  aria-hidden
                />
              </div>
            </button>
          </Card>
        </motion.div>
      </AnimatePresence>

      {!polygon ? (
        <Card className={cn(glassCard, "border-dashed border-white/15 px-4 py-6 text-center")}>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.05] ring-1 ring-white/[0.08]">
            <PenLine className="size-6 text-neutral-500" aria-hidden />
          </div>
          <p className="text-sm leading-relaxed text-neutral-400">
            Desenhe a área de voo no mapa para começar o planejamento.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          <Card className={cn(glassCard, "space-y-3 p-4")}>
            <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
              Perfil de qualidade
            </p>
            <div className="flex flex-wrap gap-2">
              {FLIGHT_QUALITY_PRESETS.map((preset) => (
                <Button
                  key={preset.id}
                  type="button"
                  size="sm"
                  variant={
                    activeQualityPreset === preset.id ? "primary" : "secondary"
                  }
                  className="min-h-11 touch-target text-xs"
                  onClick={() => applyQualityPreset(preset.id)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            {configNotices.length > 0 ? (
              <ul className="space-y-1.5 rounded-lg border border-white/10 p-2.5 text-[11px] leading-snug">
                {configNotices.map((n) => (
                  <li
                    key={n.text}
                    className={
                      n.severity === "error"
                        ? "flex gap-2 text-red-300/95"
                        : n.severity === "warning"
                          ? "flex gap-2 text-amber-200/90"
                          : "flex gap-2 text-neutral-400"
                    }
                  >
                    {n.severity === "error" ? (
                      <TriangleAlert
                        className="mt-0.5 size-3.5 shrink-0"
                        aria-hidden
                      />
                    ) : n.severity === "warning" ? (
                      <TriangleAlert
                        className="mt-0.5 size-3.5 shrink-0 text-amber-300/80"
                        aria-hidden
                      />
                    ) : (
                      <Info
                        className="mt-0.5 size-3.5 shrink-0 text-neutral-500"
                        aria-hidden
                      />
                    )}
                    <span>{n.text}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>

          <Card className={cn(glassCard, "space-y-3 p-4")}>
            <Range
              label="Altitude"
              value={params.altitudeM}
              min={30}
              max={300}
              step={5}
              unit="m"
              onChange={(v) => setParams({ altitudeM: v })}
            />
            <p className="text-[11px] text-neutral-400">
              GSD estimado:{" "}
              <span className="font-mono text-neutral-200">
                ~
                {format.number(
                  estimateGsdCmFromParams(params, droneCatalog),
                  2,
                )}{" "}
                cm/px
              </span>
              {stats ? (
                <>
                  {" "}
                  <span className="text-neutral-500">(na área:</span>{" "}
                  <span className="font-mono text-neutral-200">
                    {format.number(stats.gsdCm, 2)} cm/px
                  </span>
                  <span className="text-neutral-500">)</span>
                </>
              ) : null}
            </p>
          </Card>

          <div>
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-neutral-500">
              Clima
            </p>
            <button
              type="button"
              className={cn(
                "flex w-full min-h-[3.25rem] flex-col gap-1 rounded-xl border px-3 py-2.5 text-left transition-colors",
                weatherSectionRisk === "danger"
                  ? "border-red-500/35 bg-red-500/10 hover:bg-red-500/15"
                  : weatherSectionRisk === "warning"
                    ? "border-amber-500/35 bg-amber-500/10 hover:bg-amber-500/15"
                    : "border-primary-500/30 bg-primary-500/10 hover:bg-primary-500/15",
              )}
              onClick={() => {
                setExpandedPlannerTab("weather");
                setExpandedPlannerOpen(true);
              }}
            >
              {isWeatherLoading ? (
                <span className="flex items-center gap-2 text-sm text-neutral-400">
                  <Loader2
                    className="size-4 shrink-0 animate-spin"
                    aria-hidden
                  />
                  A carregar clima…
                </span>
              ) : currentWeather ? (
                <>
                  <span className="flex items-center gap-2 text-sm font-medium text-neutral-100">
                    <span
                      className={cn(
                        "size-2.5 shrink-0 rounded-full",
                        weatherSectionRisk === "danger"
                          ? "bg-red-400"
                          : weatherSectionRisk === "warning"
                            ? "bg-amber-400"
                            : "bg-primary-400",
                      )}
                      aria-hidden
                    />
                    {currentAssessment?.go === false
                      ? "Condições desfavoráveis"
                      : currentAssessment?.issues?.length
                        ? "Atenção às condições"
                        : "Condições adequadas"}
                  </span>
                  <span className="text-xs text-neutral-400">
                    Vento:{" "}
                    <span className="font-mono text-neutral-200">
                      {format.number(currentWeather.windSpeedMs, 1)} m/s
                    </span>
                    {" · "}
                    Temp:{" "}
                    <span className="font-mono text-neutral-200">
                      {Math.round(currentWeather.temperatureC)}°C
                    </span>
                  </span>
                </>
              ) : (
                <span className="text-sm text-neutral-400">
                  Toque para ver clima e solar no planejador completo.
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {polygon ? (
        <div
          className={cn(
            "sticky -bottom-5 z-[2] -mx-4 mt-1 space-y-3",
            configStickyBarClass(deviceTier),
          )}
        >
          <>
            <MissionSummaryBar stats={stats} isCalculating={isCalculating} />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                className="min-h-11"
                onClick={() => void saveCurrentPlan()}
                disabled={!hasPlan || saving}
              >
                {saving ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-3.5 animate-spin" />
                    Salvando…
                  </span>
                ) : (
                  "Salvar plano"
                )}
              </Button>
              <Button
                variant="outline"
                className="min-h-11"
                onClick={onRequestKmzDownload}
                disabled={!hasPlan || kmzExport.status === "generating"}
              >
                <Download className="mr-1 size-4" />
                {kmzExport.status === "generating"
                  ? "Gerando..."
                  : "Baixar KMZ"}
              </Button>
              {platform.isNative && platform.isAndroid ? (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={!hasPlan || kmzExport.status === "generating"}
                  onClick={() => setNativeKmzOpen(true)}
                >
                  Enviar ao DJI
                </Button>
              ) : null}
            </div>
          </>
        </div>
      ) : null}

      <FlightPlannerExpandedModal
        open={expandedPlannerOpen}
        onOpenChange={setExpandedPlannerOpen}
        activeTab={expandedPlannerTab}
        onTabChange={setExpandedPlannerTab}
        title={
          projectName.trim()
            ? `Planejador — ${projectName.trim()}`
            : "Planejador"
        }
        headerBadge={
          <FlightQualityScoreBadge
            params={params}
            stats={stats}
            weather={currentWeather}
            calibration={activeCalibrationSession}
          />
        }
        mission={
          <>
            <PlannerCollapsibleCard
              title="Parametros de voo"
              startsExpanded
              riskLevel="none"
            >
              <div className="flex gap-2 rounded-lg border border-white/10 bg-black/25 p-2.5 text-[11px] leading-snug text-neutral-400">
                <Info
                  className="mt-0.5 size-3.5 shrink-0 text-primary-400/90"
                  aria-hidden
                />
                <div className="space-y-1.5">
                  <p>
                    O <span className="text-neutral-300">GSD</span> (Ground
                    Sampling Distance) e o tamanho do pixel no solo:{" "}
                    <span className="text-neutral-300">altura menor</span>{" "}
                    aumenta o detalhe e o numero de fotos;{" "}
                    <span className="text-neutral-300">sobreposicao maior</span>{" "}
                    melhora a costura do ortomosaico e modelos 3D, ao custo de
                    tempo e bateria.
                  </p>
                  <p>
                    GSD estimado com este drone e altitude:{" "}
                    <span className="font-mono text-neutral-200">
                      ~
                      {format.number(
                        estimateGsdCmFromParams(params, droneCatalog),
                        2,
                      )}{" "}
                      cm/px
                    </span>
                    {stats ? (
                      <>
                        {" "}
                        (calculado na area:{" "}
                        <span className="font-mono text-neutral-200">
                          {format.number(stats.gsdCm, 2)} cm/px
                        </span>
                        ).
                      </>
                    ) : null}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                  Perfil sugerido
                </p>
                <div className="flex flex-wrap gap-2">
                  {FLIGHT_QUALITY_PRESETS.map((preset) => (
                    <Button
                      key={preset.id}
                      type="button"
                      size="sm"
                      variant={
                        activeQualityPreset === preset.id
                          ? "primary"
                          : "secondary"
                      }
                      className="text-xs"
                      onClick={() => applyQualityPreset(preset.id)}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
                <p className="text-[11px] leading-snug text-neutral-500">
                  {activeQualityPreset
                    ? FLIGHT_QUALITY_PRESETS.find(
                        (p) => p.id === activeQualityPreset,
                      )?.short
                    : "Valores personalizados: use os sliders e observe o GSD e os avisos abaixo."}
                </p>
              </div>

              {configNotices.length > 0 ? (
                <ul className="space-y-1.5 rounded-lg border border-white/10 p-2.5 text-[11px] leading-snug">
                  {configNotices.map((n) => (
                    <li
                      key={n.text}
                      className={
                        n.severity === "error"
                          ? "flex gap-2 text-red-300/95"
                          : n.severity === "warning"
                            ? "flex gap-2 text-amber-200/90"
                            : "flex gap-2 text-neutral-400"
                      }
                    >
                      {n.severity === "error" ? (
                        <TriangleAlert
                          className="mt-0.5 size-3.5 shrink-0"
                          aria-hidden
                        />
                      ) : n.severity === "warning" ? (
                        <TriangleAlert
                          className="mt-0.5 size-3.5 shrink-0 text-amber-300/80"
                          aria-hidden
                        />
                      ) : (
                        <Info
                          className="mt-0.5 size-3.5 shrink-0 text-neutral-500"
                          aria-hidden
                        />
                      )}
                      <span>{n.text}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="rounded-lg border border-white/10 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                      Drone
                    </p>
                    <p className="truncate text-sm font-medium text-neutral-100">
                      {params.droneModel}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="min-h-11 shrink-0"
                    onClick={() => setDronePickerOpen(true)}
                  >
                    Alterar drone
                  </Button>
                </div>
                <p className="mt-2 text-[11px] leading-snug text-neutral-500">
                  O GSD, frustum 3D e estatísticas usam o sensor cadastrado para
                  este modelo. CRUD de modelos custom fica em Config → Frota de
                  drones.
                </p>
              </div>
              <Range
                label="Altitude"
                value={params.altitudeM}
                min={30}
                max={300}
                step={5}
                unit="m"
                hint="Altura em relacao ao ponto de decolagem (modo comum nos apps DJI). Relevo forte exige planejamento extra; confirme limites legais e autorizacoes na sua regiao."
                onChange={(v) => setParams({ altitudeM: v })}
              />
              <div className="rounded-lg border border-white/10 p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0" id="flight-terrain-following-label">
                    <div className="flex items-center gap-2 text-xs text-neutral-200">
                      <Mountain
                        className="size-3.5 shrink-0 text-primary-400/80"
                        aria-hidden
                      />
                      <span className="font-medium">
                        Seguir o relevo (terrain following)
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] leading-snug text-neutral-500">
                      Ajusta a altitude (AMSL) de cada ponto a partir do modelo
                      Mapbox Terrain RGB, mantendo a altura AGL{" "}
                      {params.altitudeM} m aproximada sobre o terreno.
                      {!hasMapboxKey
                        ? " Adicione a chave Mapbox em Configuracoes para ativar os dados de relevo."
                        : null}
                    </p>
                  </div>
                  <Switch
                    checked={terrainFollowing}
                    onCheckedChange={setTerrainFollowing}
                    aria-labelledby="flight-terrain-following-label"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {terrainFollowing && isTerrainLoading ? (
                    <Badge
                      variant="processing"
                      className="gap-1.5 pl-1.5 text-[10px] font-medium"
                    >
                      <Loader2 className="size-2.5 animate-spin" aria-hidden />A
                      buscar elevação…
                    </Badge>
                  ) : null}
                  {!terrainFollowing ? (
                    <Badge variant="info" className="text-[10px] font-medium">
                      AGL uniforme
                    </Badge>
                  ) : isTerrainLoading ? null : hasMapboxKey ? (
                    <Badge
                      variant="success"
                      className="text-[10px] font-medium"
                    >
                      Adaptado ao terreno
                    </Badge>
                  ) : (
                    <Badge
                      variant="warning"
                      className="text-[10px] font-medium"
                    >
                      Relevo: voo plano
                    </Badge>
                  )}
                </div>
              </div>
              {hasPlan ? (
                <div className="rounded-lg border border-white/10 p-3 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs text-neutral-200">
                    <Focus
                      className="size-3.5 shrink-0 text-cyan-400/90"
                      aria-hidden
                    />
                    <span className="font-medium">
                      Ponto de interesse (POI)
                    </span>
                  </div>
                  <p className="text-[10px] leading-snug text-neutral-500">
                    Alvo comum para heading e gimbal nos waypoints sem «Ignorar
                    POI». Use «Adicionar POI» na barra lateral e clique no mapa,
                    ou ajuste a altitude AMSL do alvo abaixo.
                  </p>
                  {poi ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      <label className="grid min-w-0 flex-1 gap-1 text-[11px] text-neutral-400">
                        Altitude AMSL do POI (m)
                        <input
                          type="number"
                          className="input-base font-mono text-xs"
                          value={
                            Number.isFinite(poi.altitude)
                              ? Math.round(poi.altitude)
                              : 0
                          }
                          min={-200}
                          max={9000}
                          step={1}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            if (!Number.isFinite(v)) return;
                            setPoi({ ...poi, altitude: v });
                          }}
                        />
                      </label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 border-white/15 text-xs"
                        onClick={() => {
                          setPoi(null);
                          setPoiPlacementActive(false);
                        }}
                      >
                        Remover POI
                      </Button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-neutral-500">
                      Nenhum POI ativo. Ative «Adicionar POI» na barra do mapa e
                      clique na posição desejada.
                    </p>
                  )}
                </div>
              ) : null}
              <MapRouteDeckVisibilityToggles scope="plan" />
              <Range
                label="Sobreposicao frontal"
                value={params.forwardOverlap}
                min={60}
                max={95}
                step={1}
                unit="%"
                hint="Entre fotos na mesma faixa. Valores tipicos 70-85%. Terrenos sem textura (agua, neve) costumam precisar de mais sobreposicao."
                onChange={(v) => setParams({ forwardOverlap: v })}
              />
              <Range
                label="Sobreposicao lateral"
                value={params.sideOverlap}
                min={60}
                max={90}
                step={1}
                unit="%"
                hint="Entre faixas paralelas. Um pouco menor que a frontal e comum; muito baixa prejudica bordas e alinhamento."
                onChange={(v) => setParams({ sideOverlap: v })}
              />
              <Range
                label="Rotacao da grade"
                value={params.rotationDeg}
                min={0}
                max={180}
                step={1}
                unit="º"
                hint="Alinha as faixas ao formato da area, vento ou deslocamento. No mapa use «Ajustes da rota» na barra lateral para GPS, auto-rotacao e ajuste fino; teclas [ / ] alternam o angulo."
                onChange={(v) => setParams({ rotationDeg: v })}
              />
              <Range
                label="Velocidade"
                value={params.speedMs}
                min={3}
                max={15}
                step={1}
                unit="m/s"
                hint="Mais lento tende a reduzir desfoque e estabilizar o intervalo entre fotos; mais rapido encurta a missao se o vento e a camera permitirem."
                onChange={(v) => setParams({ speedMs: v })}
              />
              <p className="text-[11px] leading-snug text-neutral-500/90">
                Estas sugestoes nao substituem o manual do drone, regras da ANAC
                ou condicoes locais de voo. Valide sempre no app de campo antes
                de decolar.
              </p>
            </PlannerCollapsibleCard>

            <PlannerCollapsibleCard
              title="Estatísticas do voo"
              startsExpanded
              riskLevel="none"
            >
              <AnimatePresence mode="wait">
                {stats ? (
                  <motion.div
                    key="stats"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <p className="mb-2 text-[11px] leading-snug text-neutral-500">
                      GSD calculado na área desenhada; compare com o exigido
                      pelo seu software de fotogrametria.
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {(
                        [
                          {
                            label: "GSD",
                            value: `${format.number(stats.gsdCm, 2)} cm/px`,
                            icon: Focus,
                            color: "text-violet-400",
                          },
                          {
                            label: "Área",
                            value: `${format.number(stats.areaHa, 2)} ha`,
                            icon: Maximize2,
                            color: "text-primary-400",
                          },
                          {
                            label: "Waypoints",
                            value: String(stats.waypointCount),
                            icon: Navigation,
                            color: "text-sky-400",
                          },
                          {
                            label: "Faixas",
                            value: String(stats.stripCount),
                            icon: Ruler,
                            color: "text-blue-400",
                          },
                          {
                            label: "Fotos",
                            value: String(stats.estimatedPhotos),
                            icon: Camera,
                            color: "text-amber-400",
                          },
                          {
                            label: "Tempo",
                            value: `${format.number(stats.estimatedTimeMin, 0)} min`,
                            icon: Clock,
                            color: "text-orange-400",
                          },
                          {
                            label: "Baterias",
                            value: String(stats.batteryCount),
                            icon: Battery,
                            color:
                              stats.batteryCount > 2
                                ? "text-amber-400"
                                : "text-primary-400",
                          },
                          {
                            label: "Distância",
                            value: `${format.number(stats.distanceKm, 2)} km`,
                            icon: Ruler,
                            color: "text-neutral-400",
                          },
                        ] as const
                      ).map((item, i) => {
                        const Icon = item.icon;
                        return (
                          <motion.div
                            key={item.label}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, delay: i * 0.04 }}
                            className="glass-stat"
                          >
                            <p
                              className={`mb-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-neutral-500`}
                            >
                              <Icon
                                className={`size-3 ${item.color}`}
                                aria-hidden
                              />
                              {item.label}
                            </p>
                            <p className="text-sm font-semibold tabular-nums text-neutral-100">
                              {item.value}
                            </p>
                            {item.label === "Baterias" &&
                              stats.batteryCount > 2 && (
                                <div className="mt-1 flex gap-0.5">
                                  {Array.from({
                                    length: Math.min(stats.batteryCount, 6),
                                  }).map((_, bi) => (
                                    <div
                                      key={bi}
                                      className="h-1 flex-1 rounded-full bg-amber-400/60"
                                    />
                                  ))}
                                </div>
                              )}
                          </motion.div>
                        );
                      })}
                    </div>

                    {/* Estimativa de precisao posicional */}
                    {(() => {
                      const p = estimatePrecision(stats.gsdCm);
                      return (
                        <div className="mt-2 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 text-[11px]">
                          <p className="mb-1.5 font-medium text-neutral-400">
                            Precisao estimada{" "}
                            <span className="font-normal text-neutral-600">
                              (sem GCP, tipica)
                            </span>
                          </p>
                          <div className="flex gap-4 text-neutral-300">
                            <span>
                              XY:{" "}
                              <span className="font-mono text-neutral-100">
                                {p.xyMinCm}–{p.xyMaxCm} cm
                              </span>
                            </span>
                            <span>
                              Z:{" "}
                              <span className="font-mono text-neutral-100">
                                {p.zMinCm}–{p.zMaxCm} cm
                              </span>
                            </span>
                          </div>
                          <p className="mt-1 text-[10px] text-neutral-600">
                            Com GCPs:{" "}
                            <span className="text-neutral-500">
                              XY ~{format.number(0.7 * stats.gsdCm, 1)} cm / Z ~
                              {format.number(1.2 * stats.gsdCm, 1)} cm
                            </span>
                          </p>
                        </div>
                      );
                    })()}
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center gap-3 py-6 text-center"
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04] ring-1 ring-white/[0.07]">
                      <Navigation className="size-6 text-neutral-600" />
                    </div>
                    <p className="text-sm text-neutral-500">
                      Desenhe uma área no mapa para calcular o plano de voo.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
              {isCalculating && (
                <div className="inline-flex items-center gap-2 text-xs text-neutral-300">
                  <Loader2 className="size-3 animate-spin" /> Recalculando...
                </div>
              )}
            </PlannerCollapsibleCard>
          </>
        }
        weather={
          <>
            <PlannerCollapsibleCard
              title="Janela de voo estimada"
              startsExpanded={false}
              riskLevel={solarSectionRisk}
              leadingIcon={<Sun className="text-amber-300/90" aria-hidden />}
            >
              {solarPanelLines && polygonCenter ? (
                <>
                  {/* Sun arc illustration */}
                  <SolarArc
                    weather={currentWeather}
                    lat={polygonCenter.lat}
                    lon={polygonCenter.lon}
                    when={solarNow}
                  />
                  <p className="text-[11px] leading-snug text-neutral-500">
                    Posição solar, faixa ideal e ND heurístico para o centro da
                    área — não substitui análise de fotos.
                  </p>
                  <ul className="list-none space-y-1.5 text-xs leading-relaxed text-neutral-300">
                    {solarPanelLines.map((line, idx) => (
                      <motion.li
                        key={idx}
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05, duration: 0.2 }}
                        className="rounded-lg border border-white/[0.06] bg-black/20 px-2.5 py-2 text-[11px] leading-snug"
                      >
                        {line}
                      </motion.li>
                    ))}
                  </ul>
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <SolarArcEmpty />
                  <p className="text-sm text-neutral-500">
                    Desenhe a área no mapa para estimar sol, sombras e janela.
                  </p>
                </div>
              )}
            </PlannerCollapsibleCard>

            <PlannerCollapsibleCard
              title="Clima e previsão"
              startsExpanded={false}
              riskLevel={weatherSectionRisk}
            >
              {isWeatherLoading ? (
                <div className="flex items-center gap-3 py-2">
                  <Loader2 className="size-4 animate-spin text-neutral-500" />
                  <p className="text-sm text-neutral-400">
                    Carregando clima...
                  </p>
                </div>
              ) : currentWeather ? (
                <>
                  {/* Visual weather header */}
                  <WeatherHero
                    weather={currentWeather}
                    assessment={currentAssessment}
                  />

                  {currentAssessment ? (
                    <div className="space-y-2">
                      <Badge
                        variant={currentAssessment.go ? "success" : "error"}
                        className="inline-flex items-center gap-1"
                      >
                        {currentAssessment.go ? (
                          <Check className="size-3" />
                        ) : (
                          <TriangleAlert className="size-3" />
                        )}
                        {currentAssessment.go
                          ? "Condições adequadas para o perfil do drone"
                          : "Voo não recomendado"}
                      </Badge>
                      {currentAssessment.issues.length > 0 ? (
                        <ul className="list-inside list-disc space-y-1 text-xs text-red-300/95">
                          {currentAssessment.issues.map((t) => (
                            <li key={t}>{t}</li>
                          ))}
                        </ul>
                      ) : null}
                      {currentAssessment.warnings.length > 0 ? (
                        <ul className="list-inside list-disc space-y-1 text-xs text-amber-200/90">
                          {currentAssessment.warnings.map((t) => (
                            <li key={t}>{t}</li>
                          ))}
                        </ul>
                      ) : null}
                      {currentAssessment.tips.length > 0 ? (
                        <ul className="list-inside list-disc space-y-1 text-xs text-neutral-400">
                          {currentAssessment.tips.map((t) => (
                            <li key={t}>{t}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                    <Stat
                      icon={<Thermometer className="size-3" />}
                      label="Temperatura"
                      value={`${format.number(currentWeather.temperatureC, 1)} ºC`}
                    />
                    <Stat
                      icon={<Cloud className="size-3" />}
                      label="Sensacao"
                      value={
                        currentWeather.apparentTemperatureC != null
                          ? `${format.number(currentWeather.apparentTemperatureC, 1)} ºC`
                          : "—"
                      }
                    />
                    <Stat
                      icon={<Droplets className="size-3" />}
                      label="Umidade"
                      value={
                        currentWeather.relativeHumidityPct != null
                          ? `${currentWeather.relativeHumidityPct}%`
                          : "—"
                      }
                    />
                    <Stat
                      icon={<Gauge className="size-3" />}
                      label="Pressao"
                      value={
                        currentWeather.pressureHpa != null
                          ? `${format.number(currentWeather.pressureHpa, 1)} hPa`
                          : "—"
                      }
                    />
                    <Stat
                      icon={<CloudRain className="size-3" />}
                      label="Nebulosidade"
                      value={`${Math.round(currentWeather.cloudCoveragePct)}%`}
                    />
                    <Stat
                      icon={<CloudRain className="size-3" />}
                      label="Precip. (total)"
                      value={`${format.number(currentWeather.rainMmH, 2)} mm/h`}
                    />
                    <Stat
                      icon={<Wind className="size-3" />}
                      label="Vento (10 m)"
                      value={`${format.number(currentWeather.windSpeedMs, 1)} m/s`}
                    />
                    <Stat
                      icon={<Wind className="size-3" />}
                      label="Rajadas"
                      value={
                        currentWeather.windGustsMs != null
                          ? `${format.number(currentWeather.windGustsMs, 1)} m/s`
                          : "—"
                      }
                    />
                    <Stat
                      icon={<Compass className="size-3" />}
                      label="Direcao"
                      value={`${windDegToCompass(currentWeather.windDirectionDeg)} (${Math.round(currentWeather.windDirectionDeg)}º)`}
                    />
                    {(currentWeather.rainMmHRaw != null ||
                      currentWeather.showersMmH != null) && (
                      <>
                        <Stat
                          icon={<Droplets className="size-3" />}
                          label="Chuva (rain)"
                          value={
                            currentWeather.rainMmHRaw != null
                              ? `${format.number(currentWeather.rainMmHRaw, 2)} mm/h`
                              : "—"
                          }
                        />
                        <Stat
                          icon={<Droplets className="size-3" />}
                          label="Aguaceiros"
                          value={
                            currentWeather.showersMmH != null
                              ? `${format.number(currentWeather.showersMmH, 2)} mm/h`
                              : "—"
                          }
                        />
                      </>
                    )}
                  </div>

                  {currentWeather.hourlyForecast &&
                  currentWeather.hourlyForecast.length > 0 ? (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                        Proximas 24 horas (Open-Meteo)
                      </p>
                      <div className="max-h-48 overflow-y-auto rounded-lg border border-white/10">
                        <table className="w-full text-left text-[11px] text-neutral-300">
                          <thead className="sticky top-0 bg-[#141414]/95 text-[10px] uppercase text-neutral-500">
                            <tr>
                              <th className="px-2 py-1.5 font-medium">Hora</th>
                              <th className="px-2 py-1.5 font-medium">Temp</th>
                              <th className="px-2 py-1.5 font-medium">Prob.</th>
                              <th className="px-2 py-1.5 font-medium">mm/h</th>
                              <th className="px-2 py-1.5 font-medium hidden min-[380px]:table-cell">
                                Tempo
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {currentWeather.hourlyForecast.map((h) => (
                              <tr
                                key={h.time}
                                className="border-t border-white/5 hover:bg-white/[0.04]"
                              >
                                <td className="whitespace-nowrap px-2 py-1 text-neutral-200">
                                  {formatForecastHourLabel(h.time)}
                                </td>
                                <td className="px-2 py-1 font-mono tabular-nums">
                                  {format.number(h.tempC, 0)}º
                                </td>
                                <td className="px-2 py-1 font-mono tabular-nums">
                                  {h.precipProbPct}%
                                </td>
                                <td className="px-2 py-1 font-mono tabular-nums">
                                  {format.number(h.precipMm, 2)}
                                </td>
                                <td className="hidden min-[380px]:table-cell px-2 py-1 text-neutral-400">
                                  {wmoCodeToConditionPt(h.weatherCode)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-neutral-400">
                  O clima aparece apos desenhar a area.
                </p>
              )}
            </PlannerCollapsibleCard>
          </>
        }
        calibration={
          <>
            <PlannerCollapsibleCard
              title="Voo de calibração"
              startsExpanded={false}
              riskLevel="none"
            >
              <p className="text-[11px] leading-snug text-neutral-500">
                Área reduzida no centro do polígono, mesmos parâmetros de
                overlap. Pré-visualize no mapa a grade de fotos e a rota; depois
                confirme para abrir o resumo «Antes de voar» com checklist e
                exportação do KMZ de teste.
              </p>
              {calibrationMission ? (
                <ul className="mt-2 space-y-1 text-[11px] text-neutral-400">
                  <li>
                    <span className="text-neutral-500">Fotos estimadas:</span>{" "}
                    <span className="font-mono text-neutral-200">
                      {calibrationMission.stats.estimatedPhotos}
                    </span>
                    {" · "}
                    <span className="text-neutral-500">Tempo:</span>{" "}
                    <span className="font-mono text-neutral-200">
                      {format.number(
                        calibrationMission.stats.estimatedTimeMin,
                        1,
                      )}
                    </span>{" "}
                    min
                    {" · "}
                    <span className="text-neutral-500">Waypoints:</span>{" "}
                    <span className="font-mono text-neutral-200">
                      {calibrationMission.stats.waypointCount}
                    </span>
                  </li>
                </ul>
              ) : (
                <p className="mt-2 text-xs text-amber-200/85">
                  Desenhe a área e aguarde o cálculo da rota principal para
                  gerar o recorte de calibração.
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="text-[11px]"
                  disabled={!calibrationMission}
                  onClick={() => {
                    if (calibrationMapPreviewActive) {
                      setPreFlightFlow("calibration");
                      setPreFlightKey((k) => k + 1);
                      setPreFlightOpen(true);
                      return;
                    }
                    setPlannerInteractionMode("navigate");
                    setCalibrationMapPreviewActive(true);
                  }}
                >
                  {calibrationMapPreviewActive
                    ? "Confirmar voo de calibração"
                    : "Executar voo de calibração"}
                </Button>
                {calibrationMapPreviewActive ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-[11px] text-neutral-500"
                    onClick={() => setCalibrationMapPreviewActive(false)}
                  >
                    Sair da pré-visualização
                  </Button>
                ) : null}
              </div>

              <p className="mt-4 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                Histórico de calibração
              </p>
              {calibrationSessions.length === 0 ? (
                <p className="text-xs text-neutral-500">
                  Nenhuma sessão ainda.
                </p>
              ) : (
                <ul className="max-h-36 space-y-1.5 overflow-y-auto text-xs">
                  {calibrationSessions.map((s) => (
                    <li
                      key={s.id}
                      className="flex min-h-[44px] flex-wrap items-center justify-between gap-2 rounded border border-white/10 bg-black/20 px-2 py-2"
                    >
                      <span className="font-mono text-[10px] text-neutral-400">
                        {s.id.slice(0, 8)}…
                      </span>
                      <span className="text-neutral-500">
                        {new Date(s.created_at).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <div className="flex flex-wrap items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="min-h-11 shrink-0 px-3 text-[11px] text-primary-300/90"
                          onClick={() => {
                            setCalibrationSessionId(s.id);
                            toast.message("Sessão selecionada", {
                              description:
                                "O ID foi guardado no planejador para o fluxo de upload.",
                            });
                          }}
                        >
                          Usar no planejador
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="min-h-11 min-w-11 shrink-0 p-0 text-neutral-500 hover:border-red-900/40 hover:bg-red-950/30 hover:text-red-300"
                          disabled={
                            deletingCalibrationSessionId === s.id ||
                            calibrationSessionPendingDeleteId === s.id
                          }
                          aria-label="Remover sessão do histórico"
                          title="Remover do histórico"
                          onClick={() =>
                            setCalibrationSessionPendingDeleteId(s.id)
                          }
                        >
                          {deletingCalibrationSessionId === s.id ? (
                            <Loader2
                              className="size-3.5 animate-spin"
                              aria-hidden
                            />
                          ) : (
                            <Trash2 className="size-3.5" aria-hidden />
                          )}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {calibrationOutdated && (
                <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] leading-snug text-amber-200/90">
                  <TriangleAlert
                    className="mt-0.5 size-3.5 shrink-0 text-amber-400"
                    aria-hidden
                  />
                  <span>
                    <span className="font-medium">
                      Calibração desatualizada:
                    </span>{" "}
                    altitude ou sobreposição mudou significativamente desde o
                    último voo de calibração. Considere refazer a calibração com
                    os parâmetros atuais.
                  </span>
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="text-[11px]"
                  disabled={!calibrationSessionId}
                  onClick={() => setCalibrationUploadOpen(true)}
                >
                  Enviar fotos (EXIF)
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-[11px] text-neutral-500"
                  onClick={() => void loadCalibrationSessions()}
                >
                  Atualizar lista
                </Button>
              </div>
            </PlannerCollapsibleCard>
          </>
        }
        exportContent={
          <>
            <div className="min-w-0 overflow-x-auto pb-1">
              <FlightQualityScoreBadge
                params={params}
                stats={stats}
                weather={currentWeather}
                calibration={activeCalibrationSession}
              />
            </div>
            <Card className={cn(glassCard, "space-y-3")}>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  className="min-h-11"
                  onClick={() => void saveCurrentPlan()}
                  disabled={!hasPlan || saving}
                >
                  {saving ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="size-3.5 animate-spin" />
                      Salvando…
                    </span>
                  ) : (
                    "Salvar plano"
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="min-h-11"
                  onClick={onRequestKmzDownload}
                  disabled={!hasPlan || kmzExport.status === "generating"}
                >
                  <Download className="mr-1 size-4" />
                  {kmzExport.status === "generating"
                    ? "Gerando..."
                    : "Baixar KMZ"}
                </Button>
                {platform.isNative && platform.isAndroid ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    disabled={!hasPlan || kmzExport.status === "generating"}
                    onClick={() => setNativeKmzOpen(true)}
                  >
                    Enviar ao DJI
                  </Button>
                ) : null}
              </div>
              <label className="mt-1 flex min-h-11 cursor-pointer items-start gap-3 rounded-lg py-1 text-[11px] leading-snug text-neutral-500">
                <input
                  type="checkbox"
                  className="mt-1 size-4 shrink-0 cursor-pointer rounded border border-neutral-600"
                  checked={skipKmzPreFlight}
                  onChange={(e) => {
                    const v = e.target.checked;
                    writePreFlightKmzModalSkip(projectId, v);
                    bumpKmzStorageRead((n) => n + 1);
                  }}
                />
                <span>
                  Pular revisão «Antes de voar» para este projeto (o modal não
                  abre; ainda dá para reativar deixando esta opção desmarcada).
                </span>
              </label>
              {weatherError ? (
                <p
                  className={cn(
                    "text-xs",
                    isWeatherUnavailableCopy(weatherError)
                      ? "text-amber-400/95"
                      : "text-red-400",
                  )}
                >
                  {weatherError}
                </p>
              ) : null}
            </Card>
          </>
        }
      />

      {platform.isNative && platform.isAndroid ? (
        <KmzTransferNative
          open={nativeKmzOpen}
          onOpenChange={setNativeKmzOpen}
          buildKmzArrayBuffer={buildFlightKmzArrayBuffer}
        />
      ) : null}

      <CalibrationUploadDialog
        open={calibrationUploadOpen}
        onOpenChange={setCalibrationUploadOpen}
        sessionId={calibrationSessionId}
        calibrationPolygon={calibrationMission?.calibrationPolygon ?? null}
        plannerBaseLayerId={plannerBaseLayer}
        onUploaded={() => {
          void loadCalibrationSessions();
          setCalibrationSessionRevision((n) => n + 1);
        }}
      />

      <AlertDialog
        open={calibrationSessionPendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setCalibrationSessionPendingDeleteId(null);
        }}
      >
        <AlertDialogPortal>
          <AlertDialogOverlay />
          <AlertDialogContent>
            <AlertDialogTitle>Remover sessão do histórico?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Os dados e fotos associados deixam de estar disponíveis. Esta
                ação não pode ser desfeita.
              </span>
              {calibrationSessionPendingDeleteId ? (
                <span className="block font-mono text-[11px] text-neutral-500">
                  {calibrationSessionPendingDeleteId.slice(0, 8)}…
                </span>
              ) : null}
            </AlertDialogDescription>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <AlertDialogCancel asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11"
                  disabled={deletingCalibrationSessionId !== null}
                >
                  Cancelar
                </Button>
              </AlertDialogCancel>
              <Button
                type="button"
                variant="danger"
                className="min-h-11"
                disabled={
                  !calibrationSessionPendingDeleteId ||
                  deletingCalibrationSessionId !== null
                }
                loading={
                  Boolean(calibrationSessionPendingDeleteId) &&
                  deletingCalibrationSessionId ===
                    calibrationSessionPendingDeleteId
                }
                onClick={() => void confirmDeleteCalibrationSession()}
              >
                Remover
              </Button>
            </div>
          </AlertDialogContent>
        </AlertDialogPortal>
      </AlertDialog>

      <PreFlightChecklistModal
        key={preFlightKey}
        flow={preFlightFlow}
        open={preFlightOpen}
        onOpenChange={(o) => {
          setPreFlightOpen(o);
          if (!o) {
            bumpKmzStorageRead((n) => n + 1);
            setCalibrationMapPreviewActive(false);
          }
        }}
        projectId={projectId}
        params={params}
        weather={currentWeather}
        assessment={currentAssessment}
        polygonCenter={polygonCenter}
        missionPolygon={polygon}
        calibrationMission={calibrationMission}
        calibrationSessionId={calibrationSessionId}
        missionStats={stats}
        calibrationSessionRevision={calibrationSessionRevision}
        onRequestCalibrationUpload={() => setCalibrationUploadOpen(true)}
        onConfirmDownload={() => {
          void kmzExport.generateAndDownload(waypoints, params, { poi });
        }}
        onCalibrationDownload={async () => {
          if (!calibrationMission) return;
          try {
            const created = await projectsService.createCalibrationSession(
              projectId,
              {
                params_snapshot: {
                  ...params,
                  ...calibrationOpticsSnapshot,
                  _calibration: {
                    gsdCm: calibrationMission.stats.gsdCm,
                    estimatedPhotos: calibrationMission.stats.estimatedPhotos,
                    estimatedTimeMin: calibrationMission.stats.estimatedTimeMin,
                  },
                } as unknown as Record<string, unknown>,
                polygon_snapshot:
                  calibrationMission.calibrationPolygon as unknown as Record<
                    string,
                    unknown
                  >,
              },
            );
            setCalibrationSessionId(created.session_id);
            await kmzCalibExport.generateAndDownload(
              calibrationMission.waypoints,
              params,
              {
                variant: "calibration",
                poi: null,
              },
            );
            toast.success("Sessão de calibração criada e KMZ baixado.");
            void loadCalibrationSessions();
          } catch {
            toast.error(
              "Não foi possível criar a sessão ou gerar o KMZ de calibração.",
            );
          }
        }}
        isGeneratingKmz={kmzExport.status === "generating"}
        isCalibrationKmzGenerating={kmzCalibExport.status === "generating"}
      />

      <DronePicker
        open={dronePickerOpen}
        onOpenChange={setDronePickerOpen}
        params={params}
        setParams={setParams}
        models={droneCatalog}
        isLoading={droneModelsLoading}
        isError={droneModelsError}
      />
    </div>
  );
}
