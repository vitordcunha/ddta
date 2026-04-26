import { create } from 'zustand'
import type { ResultLayerId } from '@/features/results/types'

export type ResultsMapToolId = 'none' | 'distance' | 'area' | 'elevation'

/** Leaflet LatLngBounds format: [[south, west], [north, east]] */
export type MapBounds = [[number, number], [number, number]]

const initial = {
  activeLayer: 'orthophoto' as ResultLayerId,
  /** Trajeto real a partir de EXIF/XMP (painel Resultados + mapa deck). */
  showRealFlightPath: false,
  opacity: 85,
  tool: 'none' as ResultsMapToolId,
  distancePoints: [] as [number, number][],
  areaPoints: [] as [number, number][],
  elevationPoint: null as [number, number] | null,
  autoFitBounds: null as MapBounds | null,
  /** Chaves `full:current`, `full:<runId>`, `preview:current`, `preview:<runId>`. */
  orthophotoLayerVisibility: {} as Record<string, boolean>,
  /** Opacidade 0–100 por chave de ortomosaico (predefinido 85 ao aparecer nova execução). */
  orthophotoLayerOpacity: {} as Record<string, number>,
  /** Qual execução mostra detalhes no painel (preset, data, métricas). */
  selectedRunDetailKey: null as string | null,
}

type ResultsViewState = typeof initial & {
  setActiveLayer: (id: ResultLayerId) => void
  setShowRealFlightPath: (v: boolean) => void
  setOpacity: (n: number) => void
  setTool: (t: ResultsMapToolId) => void
  addDistancePoint: (p: [number, number]) => void
  addAreaPoint: (p: [number, number]) => void
  setElevationPoint: (p: [number, number] | null) => void
  setAutoFitBounds: (bounds: MapBounds | null) => void
  ensureOrthophotoLayerKeys: (keys: string[]) => void
  setOrthophotoLayerVisibility: (key: string, visible: boolean) => void
  setOrthophotoLayerOpacity: (key: string, opacityPct: number) => void
  setSelectedRunDetailKey: (key: string | null) => void
  clearDrawing: () => void
  reset: () => void
}

export const useResultsViewStore = create<ResultsViewState>((set) => ({
  ...initial,
  setActiveLayer: (activeLayer) => set({ activeLayer }),
  setShowRealFlightPath: (showRealFlightPath) => set({ showRealFlightPath }),
  setOpacity: (opacity) => set({ opacity }),
  setTool: (tool) => set({ tool }),
  addDistancePoint: (p) =>
    set((s) => ({ distancePoints: [...s.distancePoints, p] })),
  addAreaPoint: (p) => set((s) => ({ areaPoints: [...s.areaPoints, p] })),
  setElevationPoint: (elevationPoint) => set({ elevationPoint }),
  setAutoFitBounds: (autoFitBounds) => set({ autoFitBounds }),
  ensureOrthophotoLayerKeys: (keys) =>
    set((s) => {
      const vis = { ...s.orthophotoLayerVisibility }
      const op = { ...s.orthophotoLayerOpacity }
      for (const k of keys) {
        if (vis[k] === undefined) vis[k] = true
        if (op[k] === undefined) op[k] = 85
      }
      return { orthophotoLayerVisibility: vis, orthophotoLayerOpacity: op }
    }),
  setOrthophotoLayerVisibility: (key, visible) =>
    set((s) => ({
      orthophotoLayerVisibility: { ...s.orthophotoLayerVisibility, [key]: visible },
    })),
  setOrthophotoLayerOpacity: (key, opacityPct) =>
    set((s) => {
      const n = Math.max(0, Math.min(100, Math.round(opacityPct)))
      return { orthophotoLayerOpacity: { ...s.orthophotoLayerOpacity, [key]: n } }
    }),
  setSelectedRunDetailKey: (selectedRunDetailKey) => set({ selectedRunDetailKey }),
  clearDrawing: () =>
    set({
      distancePoints: [],
      areaPoints: [],
      elevationPoint: null,
      tool: 'none',
    }),
  reset: () => set({ ...initial }),
}))
