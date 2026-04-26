import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { fetchMapApiKeys } from '@/services/mapApiKeysService'
import type { MapEngineState, MapMode, MapProvider } from '@/features/map-engine/types'

const LS_PREFS = 'map-engine:preferences'

type StoredPrefs = {
  provider?: MapProvider
  mode?: MapMode
  center?: [number, number]
  zoom?: number
}

const DEFAULT_CENTER: [number, number] = [-15.793889, -47.882778]
const DEFAULT_ZOOM = 15

function readPrefs(): StoredPrefs {
  try {
    const raw = localStorage.getItem(LS_PREFS)
    if (!raw) return {}
    return JSON.parse(raw) as StoredPrefs
  } catch {
    return {}
  }
}

function writePrefs(p: Pick<MapEngineState, 'provider' | 'mode' | 'center' | 'zoom'>) {
  try {
    localStorage.setItem(
      LS_PREFS,
      JSON.stringify({
        provider: p.provider,
        mode: p.mode,
        center: p.center,
        zoom: p.zoom,
      }),
    )
  } catch {
    /* ignore */
  }
}

export type MapEngineContextValue = MapEngineState & {
  mapboxToken: string
  googleMapsApiKey: string
  setProvider: (provider: MapProvider) => void
  setMode: (mode: MapMode) => void
  setCenterZoom: (center: [number, number], zoom: number) => void
  refreshMapApiKeys: () => Promise<void>
}

export const MapEngineContext = createContext<MapEngineContextValue | null>(null)

export function MapEngineProvider({ children }: { children: ReactNode }) {
  const stored = readPrefs()
  const initialProvider: MapProvider =
    stored.provider === 'mapbox' || stored.provider === 'google' || stored.provider === 'leaflet'
      ? stored.provider
      : 'leaflet'
  let initialMode: MapMode = stored.mode === '3d' || stored.mode === '2d' ? stored.mode : '2d'
  if (initialProvider === 'leaflet') initialMode = '2d'

  const [provider, setProviderState] = useState<MapProvider>(initialProvider)
  const [mode, setModeState] = useState<MapMode>(initialMode)
  const [center, setCenter] = useState<[number, number]>(
    Array.isArray(stored.center) &&
      stored.center.length === 2 &&
      Number.isFinite(stored.center[0]) &&
      Number.isFinite(stored.center[1])
      ? [stored.center[0], stored.center[1]]
      : DEFAULT_CENTER,
  )
  const [zoom, setZoom] = useState<number>(
    typeof stored.zoom === 'number' && Number.isFinite(stored.zoom) ? stored.zoom : DEFAULT_ZOOM,
  )
  const [mapboxToken, setMapboxToken] = useState('')
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState('')

  const loadKeys = useCallback(async () => {
    try {
      const data = await fetchMapApiKeys()
      setMapboxToken((data.mapbox_api_key ?? '').trim())
      setGoogleMapsApiKey((data.google_maps_api_key ?? '').trim())
    } catch {
      setMapboxToken('')
      setGoogleMapsApiKey('')
    }
  }, [])

  useEffect(() => {
    void loadKeys()
  }, [loadKeys])

  useEffect(() => {
    writePrefs({ provider, mode, center, zoom })
  }, [provider, mode, center, zoom])

  const setCenterZoom = useCallback((nextCenter: [number, number], nextZoom: number) => {
    setCenter(nextCenter)
    setZoom(nextZoom)
  }, [])

  const setProvider = useCallback((next: MapProvider) => {
    setProviderState(next)
    if (next === 'leaflet') {
      setModeState('2d')
    }
  }, [])

  const setMode = useCallback(
    (next: MapMode) => {
      if (provider === 'leaflet') return
      setModeState(next)
    },
    [provider],
  )

  useEffect(() => {
    if (provider === 'leaflet' && mode !== '2d') {
      setModeState('2d')
    }
  }, [provider, mode])

  const value = useMemo<MapEngineContextValue>(
    () => ({
      provider,
      mode,
      center,
      zoom,
      mapboxToken,
      googleMapsApiKey,
      setProvider,
      setMode,
      setCenterZoom,
      refreshMapApiKeys: loadKeys,
    }),
    [
      provider,
      mode,
      center,
      zoom,
      mapboxToken,
      googleMapsApiKey,
      setProvider,
      setMode,
      setCenterZoom,
      loadKeys,
    ],
  )

  return <MapEngineContext.Provider value={value}>{children}</MapEngineContext.Provider>
}
