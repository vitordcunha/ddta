import { create } from 'zustand'
import type { Feature, Polygon } from 'geojson'
import type {
  FlightAssessment,
  FlightParams,
  FlightStats,
  PlannerGeoPolygon,
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
}

type FlightStore = PersistedFlightPlan & {
  isCalculating: boolean
  setPolygon: (polygon: PlannerGeoPolygon | null) => void
  setParams: (params: Partial<FlightParams>) => void
  setResult: (waypoints: Waypoint[], stats: FlightStats | null) => void
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
  stats: null,
  weather: null,
  assessment: null,
  isCalculating: false,
  setPolygon: (polygon) => set({ polygon }),
  setParams: (params) => set((state) => ({ params: { ...state.params, ...params } })),
  setResult: (waypoints, stats) => set({ waypoints, stats }),
  setWeather: (weather, assessment) => set({ weather, assessment }),
  setIsCalculating: (value) => set({ isCalculating: value }),
  loadPlan: (plan) => set({ ...plan }),
  resetPlan: () =>
    set({
      polygon: null,
      params: initialFlightParams,
      waypoints: [],
      stats: null,
      weather: null,
      assessment: null,
      isCalculating: false,
    }),
}))
