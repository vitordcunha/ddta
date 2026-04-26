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
} from '@/features/flight-planner/types'
import type { PointOfInterest } from '@/features/flight-planner/types/poi'
import { migratePoi } from '@/features/flight-planner/types/poi'
import type { Waypoint } from '@/features/flight-planner/types/waypoint'
import { migrateWaypoints } from '@/features/flight-planner/types/waypoint'
import { applyPoiAttitudeToWaypoints } from '@/features/flight-planner/utils/poiCalculator'

export type PersistedFlightPlan = {
  polygon: Feature<Polygon> | null
  params: FlightParams
  waypoints: Waypoint[]
  stats: FlightStats | null
  weather: WeatherData | null
  assessment: FlightAssessment | null
  /** Sessão de calibração no backend (Fase 2–3); opcional para compatibilidade com snapshots antigos. */
  calibrationSessionId?: string | null
  terrainFollowing?: boolean
  poi?: PointOfInterest | null
}

export type PlannerInteractionMode = 'navigate' | 'draw'

/** Posicao de referencia para aproximar o primeiro waypoint da rota (ex.: operador). */
export type RouteStartRef = { lat: number; lng: number }

/** Visibilidade da rota/waypoints no deck.gl (Mapbox 3D); separado por painel para defaults distintos. */
export type DeckMapVisibility = {
  showRoute: boolean
  showWaypoints: boolean
}

export const defaultDeckMapVisibility = (): {
  plan: DeckMapVisibility
  results: DeckMapVisibility
} => ({
  plan: { showRoute: true, showWaypoints: true },
  results: { showRoute: false, showWaypoints: true },
})

type FlightStore = PersistedFlightPlan & {
  strips: Strip[]
  terrainFollowing: boolean
  poi: PointOfInterest | null
  /** Próximo clique no mapa (Leaflet/Mapbox) define ou move o POI. */
  poiPlacementActive: boolean
  selectedWaypointId: string | null
  deckMapVisibility: {
    plan: DeckMapVisibility
    results: DeckMapVisibility
  }
  setDeckMapVisibility: (
    scope: 'plan' | 'results',
    patch: Partial<DeckMapVisibility>,
  ) => void
  /** Correlaciona KMZ de calibração com upload na Fase 3. */
  calibrationSessionId: string | null
  setCalibrationSessionId: (id: string | null) => void
  calibrationMapPreviewActive: boolean
  setCalibrationMapPreviewActive: (active: boolean) => void
  updateWaypoint: (id: string, patch: Partial<Waypoint>) => void
  /** Copia gimbal e heading do waypoint de origem para todos sem `poiOverride`. */
  copyAttitudeFromWaypointToAll: (sourceId: string) => void
  setTerrainFollowing: (enabled: boolean) => void
  /** true enquanto busca elevações (terrain following) está em andamento. */
  isTerrainLoading: boolean
  setTerrainLoading: (value: boolean) => void
  setSelectedWaypoint: (id: string | null) => void
  setPoi: (poi: PointOfInterest | null) => void
  setPoiPlacementActive: (active: boolean) => void
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
  droneModelId: null,
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
  terrainFollowing: false,
  isTerrainLoading: false,
  poi: null,
  poiPlacementActive: false,
  selectedWaypointId: null,
  deckMapVisibility: defaultDeckMapVisibility(),
  setDeckMapVisibility: (scope, patch) =>
    set((state) => ({
      deckMapVisibility: {
        ...state.deckMapVisibility,
        [scope]: { ...state.deckMapVisibility[scope], ...patch },
      },
    })),
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
  updateWaypoint: (id, patch) =>
    set((state) => {
      let waypoints = state.waypoints.map((w) => {
        if (w.id !== id) return w
        const next: Waypoint = { ...w, ...patch }
        if (Object.prototype.hasOwnProperty.call(patch, 'altitude')) {
          if (!Object.prototype.hasOwnProperty.call(patch, 'manualAltitude')) {
            next.manualAltitude = true
          }
        }
        return next
      })
      const poi = state.poi
      const shouldReapplyPoi =
        poi != null &&
        (Object.keys(patch).some((k) =>
          ['lat', 'lng', 'altitude', 'altitudeMode', 'terrainElevation'].includes(k),
        ) ||
          patch.poiOverride === false)
      if (shouldReapplyPoi) {
        waypoints = applyPoiAttitudeToWaypoints(waypoints, poi)
      }
      return { waypoints }
    }),
  copyAttitudeFromWaypointToAll: (sourceId) =>
    set((state) => {
      const src = state.waypoints.find((w) => w.id === sourceId)
      if (!src) return state
      return {
        waypoints: state.waypoints.map((w) =>
          w.poiOverride ? w : { ...w, gimbalPitch: src.gimbalPitch, heading: src.heading },
        ),
      }
    }),
  setTerrainFollowing: (terrainFollowing) => set({ terrainFollowing }),
  setTerrainLoading: (isTerrainLoading) => set({ isTerrainLoading }),
  setSelectedWaypoint: (selectedWaypointId) => set({ selectedWaypointId }),
  setPoi: (next) =>
    set((state) => {
      if (!next) return { poi: null, poiPlacementActive: false }
      const merged =
        state.poi && state.poi.id === next.id ? { ...state.poi, ...next } : next
      return {
        poi: merged,
        waypoints: applyPoiAttitudeToWaypoints(state.waypoints, merged),
        poiPlacementActive: false,
      }
    }),
  setPoiPlacementActive: (poiPlacementActive) => set({ poiPlacementActive }),
  setResult: (waypoints, stats, strips) => set({ waypoints, stats, strips }),
  setWeather: (weather, assessment) => set({ weather, assessment }),
  setIsCalculating: (value) => set({ isCalculating: value }),
  loadPlan: (plan) =>
    set({
      polygon: plan.polygon,
      params: {
        ...initialFlightParams,
        ...plan.params,
        droneModelId: plan.params.droneModelId ?? null,
      },
      waypoints: migrateWaypoints(plan.waypoints as unknown[]),
      stats: plan.stats,
      weather: plan.weather,
      assessment: plan.assessment,
      calibrationSessionId: plan.calibrationSessionId ?? null,
      terrainFollowing: plan.terrainFollowing ?? false,
      isTerrainLoading: false,
      poi: migratePoi(plan.poi as unknown),
      poiPlacementActive: false,
      selectedWaypointId: null,
      deckMapVisibility: defaultDeckMapVisibility(),
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
      terrainFollowing: false,
      isTerrainLoading: false,
      poi: null,
      poiPlacementActive: false,
      selectedWaypointId: null,
      deckMapVisibility: defaultDeckMapVisibility(),
      calibrationSessionId: null,
      calibrationMapPreviewActive: false,
      isCalculating: false,
      routeStartRef: null,
      draftPoints: [],
      plannerInteractionMode: 'draw',
    }),
}))
