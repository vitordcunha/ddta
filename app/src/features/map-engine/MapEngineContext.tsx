import {
  createContext,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useFlightStore } from "@/features/flight-planner/stores/useFlightStore";
import { fetchMapApiKeys } from "@/services/mapApiKeysService";
import type {
  MapEngineState,
  MapMode,
  MapProvider,
} from "@/features/map-engine/types";
import {
  detectDeviceTier,
  type DeviceTier,
} from "@/features/map-engine/utils/detectDeviceTier";

const LS_PREFS = "map-engine:preferences";

/**
 * API imperativa exposta pelos providers de mapa (Leaflet, Mapbox, Google).
 * Cada provider registra sua implementação via `registerMapApi`.
 */
export type MapImperativeApi = {
  getCenter: () => [number, number]
  disablePan: () => void
  enablePan: () => void
  /** Desabilita gestos que conflitam com modo desenho (rotate/tilt em 2 dedos). */
  disableDrawConflictGestures: () => void
  enableDrawConflictGestures: () => void
  /** Reset do bearing (norte). */
  setBearing: (bearing: number) => void
  /** Altera pitch em `delta` graus, respeitando min/max do provider. */
  changePitch: (delta: number) => void
  /** Zoom in (delta > 0) ou zoom out (delta < 0). */
  changeZoom: (delta: number) => void
  /**
   * Encaixa o view ao retangulo `[[south, west], [north, east]]` (lat, lng) — formato Leaflet/resultados.
   * Opcional em provedores; se nao houver, o call e ignorado.
   */
  fitBounds: (
    bounds: [[number, number], [number, number]],
    padding?: number,
  ) => void
}

type StoredPrefs = {
  provider?: MapProvider;
  mode?: MapMode;
  center?: [number, number];
  zoom?: number;
};

const DEFAULT_CENTER: [number, number] = [-15.793889, -47.882778];
const DEFAULT_ZOOM = 15;

function readPrefs(): StoredPrefs {
  try {
    const raw = localStorage.getItem(LS_PREFS);
    if (!raw) return {};
    return JSON.parse(raw) as StoredPrefs;
  } catch {
    return {};
  }
}

function writePrefs(
  p: Pick<MapEngineState, "provider" | "mode" | "center" | "zoom">,
) {
  try {
    localStorage.setItem(
      LS_PREFS,
      JSON.stringify({
        provider: p.provider,
        mode: p.mode,
        center: p.center,
        zoom: p.zoom,
      }),
    );
  } catch {
    /* ignore */
  }
}

export type MapEngineContextValue = MapEngineState & {
  mapboxToken: string;
  googleMapsApiKey: string;
  deviceTier: DeviceTier;
  setProvider: (provider: MapProvider) => void;
  setMode: (mode: MapMode) => void;
  setCenterZoom: (center: [number, number], zoom: number) => void;
  refreshMapApiKeys: () => Promise<void>;
  /** Registra a API imperativa do provider de mapa ativo. Substitui completamente a anterior. */
  registerMapApi: (api: Partial<MapImperativeApi>) => void;
  getMapCenter: () => [number, number];
  disableMapPan: () => void;
  enableMapPan: () => void;
  disableDrawConflictGestures: () => void;
  enableDrawConflictGestures: () => void;
  setBearing: (bearing: number) => void;
  changePitch: (delta: number) => void;
  changeZoom: (delta: number) => void;
  fitMapBounds: (bounds: [[number, number], [number, number]], padding?: number) => void;
};

export const MapEngineContext = createContext<MapEngineContextValue | null>(
  null,
);

export function MapEngineProvider({ children }: { children: ReactNode }) {
  const stored = readPrefs();
  const initialProvider: MapProvider =
    stored.provider === "mapbox" ||
    stored.provider === "google" ||
    stored.provider === "leaflet"
      ? stored.provider
      : "leaflet";
  const tierAtBoot = detectDeviceTier();
  let initialMode: MapMode =
    stored.mode === "3d" || stored.mode === "2d" ? stored.mode : "2d";
  if (initialProvider === "leaflet") initialMode = "2d";
  if (
    tierAtBoot === "none" &&
    initialMode === "3d" &&
    (initialProvider === "mapbox" || initialProvider === "google")
  ) {
    initialMode = "2d";
  }

  const [provider, setProviderState] = useState<MapProvider>(initialProvider);
  const [mode, setModeState] = useState<MapMode>(initialMode);
  const [center, setCenter] = useState<[number, number]>(
    Array.isArray(stored.center) &&
      stored.center.length === 2 &&
      Number.isFinite(stored.center[0]) &&
      Number.isFinite(stored.center[1])
      ? [stored.center[0], stored.center[1]]
      : DEFAULT_CENTER,
  );
  const [zoom, setZoom] = useState<number>(
    typeof stored.zoom === "number" && Number.isFinite(stored.zoom)
      ? stored.zoom
      : DEFAULT_ZOOM,
  );
  const [mapboxToken, setMapboxToken] = useState("");
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState("");
  // Detectado uma vez no boot; imutável durante a sessão.
  const [deviceTier] = useState<DeviceTier>(() => detectDeviceTier());

  // API imperativa do provider ativo; substituída quando o provider monta.
  const mapApiRef = useRef<Partial<MapImperativeApi>>({});
  const registerMapApi = useCallback((api: Partial<MapImperativeApi>) => {
    mapApiRef.current = api;
  }, []);
  const getMapCenter = useCallback((): [number, number] => {
    return mapApiRef.current.getCenter?.() ?? center;
  }, [center]);
  const disableMapPan = useCallback(() => mapApiRef.current.disablePan?.(), []);
  const enableMapPan = useCallback(() => mapApiRef.current.enablePan?.(), []);
  const disableDrawConflictGestures = useCallback(
    () => mapApiRef.current.disableDrawConflictGestures?.(),
    [],
  );
  const enableDrawConflictGestures = useCallback(
    () => mapApiRef.current.enableDrawConflictGestures?.(),
    [],
  );
  const setBearing = useCallback(
    (bearing: number) => mapApiRef.current.setBearing?.(bearing),
    [],
  );
  const changePitch = useCallback(
    (delta: number) => mapApiRef.current.changePitch?.(delta),
    [],
  );
  const changeZoom = useCallback(
    (delta: number) => mapApiRef.current.changeZoom?.(delta),
    [],
  );

  const loadKeys = useCallback(async () => {
    try {
      const data = await fetchMapApiKeys();
      setMapboxToken((data.mapbox_api_key ?? "").trim());
      setGoogleMapsApiKey((data.google_maps_api_key ?? "").trim());
    } catch {
      setMapboxToken("");
      setGoogleMapsApiKey("");
    }
  }, []);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  useLayoutEffect(() => {
    try {
      if (typeof localStorage === "undefined") return;
      const raw = localStorage.getItem("flight:map3dFrustum");
      if (raw === "0" || raw === "1") {
        useFlightStore.getState().setFrustum3dInDeck(raw === "1");
        return;
      }
      const next = deviceTier !== "low";
      useFlightStore.getState().setFrustum3dInDeck(next);
    } catch {
      /* ignore */
    }
  }, [deviceTier]);

  useEffect(() => {
    writePrefs({ provider, mode, center, zoom });
  }, [provider, mode, center, zoom]);

  const setCenterZoom = useCallback(
    (nextCenter: [number, number], nextZoom: number) => {
      setCenter(nextCenter);
      setZoom(nextZoom);
    },
    [],
  );

  const fitMapBounds = useCallback(
    (bounds: [[number, number], [number, number]], padding: number = 32) => {
      const fit = mapApiRef.current.fitBounds;
      if (fit) {
        fit(bounds, padding);
        return;
      }
      const [[south, west], [north, east]] = bounds;
      const lat = (south + north) / 2;
      const lng = (west + east) / 2;
      const latSpan = Math.max(1e-6, Math.abs(north - south));
      const z = Math.min(
        20,
        Math.max(4, 14 - Math.log2(Math.max(latSpan, 0.0001) * 30)),
      );
      setCenterZoom([lat, lng], z);
    },
    [setCenterZoom],
  );

  const setProvider = useCallback((next: MapProvider) => {
    setProviderState(next);
    if (next === "leaflet") {
      setModeState("2d");
    }
  }, []);

  const setMode = useCallback(
    (next: MapMode) => {
      if (provider === "leaflet") return;
      setModeState(next);
    },
    [provider],
  );

  useEffect(() => {
    if (provider === "leaflet" && mode !== "2d") {
      setModeState("2d");
    }
  }, [provider, mode]);

  useEffect(() => {
    if (
      deviceTier === "none" &&
      (provider === "mapbox" || provider === "google") &&
      mode === "3d"
    ) {
      setModeState("2d");
    }
  }, [deviceTier, provider, mode]);

  const value = useMemo<MapEngineContextValue>(
    () => ({
      provider,
      mode,
      center,
      zoom,
      mapboxToken,
      googleMapsApiKey,
      deviceTier,
      setProvider,
      setMode,
      setCenterZoom,
      refreshMapApiKeys: loadKeys,
      registerMapApi,
      getMapCenter,
      disableMapPan,
      enableMapPan,
      disableDrawConflictGestures,
      enableDrawConflictGestures,
      setBearing,
      changePitch,
      changeZoom,
      fitMapBounds,
    }),
    [
      provider,
      mode,
      center,
      zoom,
      mapboxToken,
      googleMapsApiKey,
      deviceTier,
      setProvider,
      setMode,
      setCenterZoom,
      loadKeys,
      registerMapApi,
      getMapCenter,
      disableMapPan,
      enableMapPan,
      disableDrawConflictGestures,
      enableDrawConflictGestures,
      setBearing,
      changePitch,
      changeZoom,
      fitMapBounds,
    ],
  );

  return (
    <MapEngineContext.Provider value={value}>
      {children}
    </MapEngineContext.Provider>
  );
}
