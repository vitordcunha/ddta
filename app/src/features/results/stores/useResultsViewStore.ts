import { create } from 'zustand'
import type { ResultLayerId } from '@/features/results/types'

export type ResultsMapToolId = 'none' | 'distance' | 'area' | 'elevation'

const initial = {
  activeLayer: 'orthophoto' as ResultLayerId,
  opacity: 85,
  tool: 'none' as ResultsMapToolId,
  distancePoints: [] as [number, number][],
  areaPoints: [] as [number, number][],
  elevationPoint: null as [number, number] | null,
}

type ResultsViewState = typeof initial & {
  setActiveLayer: (id: ResultLayerId) => void
  setOpacity: (n: number) => void
  setTool: (t: ResultsMapToolId) => void
  addDistancePoint: (p: [number, number]) => void
  addAreaPoint: (p: [number, number]) => void
  setElevationPoint: (p: [number, number] | null) => void
  clearDrawing: () => void
  reset: () => void
}

export const useResultsViewStore = create<ResultsViewState>((set) => ({
  ...initial,
  setActiveLayer: (activeLayer) => set({ activeLayer }),
  setOpacity: (opacity) => set({ opacity }),
  setTool: (tool) => set({ tool }),
  addDistancePoint: (p) =>
    set((s) => ({ distancePoints: [...s.distancePoints, p] })),
  addAreaPoint: (p) => set((s) => ({ areaPoints: [...s.areaPoints, p] })),
  setElevationPoint: (elevationPoint) => set({ elevationPoint }),
  clearDrawing: () =>
    set({
      distancePoints: [],
      areaPoints: [],
      elevationPoint: null,
      tool: 'none',
    }),
  reset: () => set({ ...initial }),
}))
