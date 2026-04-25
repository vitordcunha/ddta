import { create } from 'zustand'
import type { Feature, Polygon } from 'geojson'
import type { PlannerBaseLayerId } from '@/features/flight-planner/constants/mapBaseLayers'
import type {
  FlightAssessment,
  FlightParams,
  FlightStats,
  PlannerGeoPolygon,
  Strip,
  WeatherData,
  Waypoint,
} from '@/features/flight-planner/types'

export type PersistedFlightPlan = {
  polygon: Feature<Polygon> | null
  params: FlightParams
  waypoints: Waypoint[]
  stats: FlightStats | null
  weather: WeatherData | null
  assessment: FlightAssessment | null
  /** Sessão de calibração no backend (Fase 2–3); opcional para compatibilidade com snapshots antigos. */
  calibrationSessionId?: string | null
}

export type PlannerInteractionMode = 'navigate' | 'draw'

/** Posicao de referencia para aproximar o primeiro waypoint da rota (ex.: operador). */
export type RouteStartRef = { lat: number; lng: number }

type FlightStore = PersistedFlightPlan & {
  strips: Strip[]
  /** Correlaciona KMZ de calibração com upload na Fase 3. */
  calibrationSessionId: string | null
  setCalibrationSessionId: (id: string | null) => void
  calibrationMapPreviewActive: boolean
  setCalibrationMapPreviewActive: (active: boolean) => void
  isCalculating: boolean
  /** Quando definido, o calculo escolhe LTR/RTL e sentido do percurso para minimizar distancia ate este ponto. */
  routeStartRef: RouteStartRef | null
  setRouteStartRef: (ref: RouteStartRef | null) => void
  draftPoints: [number, number][]
  setDraftPoints: (points: [number, number][]) => void
  addDraftPoint: (point: [number, number]) => void
  popLastDraftPoint: () => void
  plannerInteractionMode: PlannerInteractionMode
  setPlannerInteractionMode: (mode: PlannerInteractionMode) => void
  plannerBaseLayer: PlannerBaseLayerId
  setPlannerBaseLayer: (id: PlannerBaseLayerId) => void
  setPolygon: (polygon: PlannerGeoPolygon | null) => void
  setParams: (params: Partial<FlightParams>) => void
  setResult: (waypoints: Waypoint[], stats: FlightStats | null, strips: Strip[]) => void
  setWeather: (weather: WeatherData | null, assessment: FlightAssessment | null) => void
  setIsCalculating: (value: boolean) => void
  loadPlan: (plan: PersistedFlightPlan) => void
  resetPlan: () => void
}

export const initialFlightParams: FlightParams = {
  droneModel: 'Mini 4 Pro',
  altitudeM: 120,
  forwardOverlap: 80,
  sideOverlap: 70,
  rotationDeg: 0,
  speedMs: 8,
}

export const useFlightStore = create<FlightStore>((set) => ({
  polygon: null,
  params: initialFlightParams,
  waypoints: [],
  strips: [],
  stats: null,
  weather: null,
  assessment: null,
  calibrationSessionId: null,
  setCalibrationSessionId: (calibrationSessionId) => set({ calibrationSessionId }),
  calibrationMapPreviewActive: false,
  setCalibrationMapPreviewActive: (calibrationMapPreviewActive) =>
    set({ calibrationMapPreviewActive }),
  isCalculating: false,
  routeStartRef: null,
  draftPoints: [],
  plannerInteractionMode: 'draw',
  plannerBaseLayer: 'dark',
  setRouteStartRef: (routeStartRef) => set({ routeStartRef }),
  setDraftPoints: (draftPoints) => set({ draftPoints }),
  addDraftPoint: (point) =>
    set((state) => ({ draftPoints: [...state.draftPoints, point] })),
  popLastDraftPoint: () =>
    set((state) => ({
      draftPoints: state.draftPoints.slice(0, -1),
    })),
  setPlannerInteractionMode: (plannerInteractionMode) =>
    set({ plannerInteractionMode }),
  setPlannerBaseLayer: (plannerBaseLayer) => set({ plannerBaseLayer }),
  setPolygon: (polygon) => set({ polygon }),
  setParams: (params) => set((state) => ({ params: { ...state.params, ...params } })),
  setResult: (waypoints, stats, strips) => set({ waypoints, stats, strips }),
  setWeather: (weather, assessment) => set({ weather, assessment }),
  setIsCalculating: (value) => set({ isCalculating: value }),
  loadPlan: (plan) =>
    set({
      polygon: plan.polygon,
      params: plan.params,
      waypoints: plan.waypoints,
      stats: plan.stats,
      weather: plan.weather,
      assessment: plan.assessment,
      calibrationSessionId: plan.calibrationSessionId ?? null,
      calibrationMapPreviewActive: false,
      draftPoints: [],
      strips: [],
      routeStartRef: null,
    }),
  resetPlan: () =>
    set({
      polygon: null,
      params: initialFlightParams,
      waypoints: [],
      strips: [],
      stats: null,
      weather: null,
      assessment: null,
      calibrationSessionId: null,
      calibrationMapPreviewActive: false,
      isCalculating: false,
      routeStartRef: null,
      draftPoints: [],
      plannerInteractionMode: 'draw',
    }),
}))
