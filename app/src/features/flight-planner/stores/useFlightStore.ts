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
import { closeDraftToPolygon } from '@/features/flight-planner/utils/polygonDraft'

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
  /**
   * Campo de visão 3D (frustum) no deck. Default depende de deviceTier (O.7); o usuário pode persistir
   * em `localStorage` (`flight:map3dFrustum`) via setFrustum3dInDeck.
   */
  frustum3dInDeck: boolean
  setFrustum3dInDeck: (v: boolean) => void
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
  /** Fecha o polígono com os draftPoints atuais e limpa os drafts. */
  closeDraft: () => void
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
  /** Move o vértice `index` do polígono atual para `latLng`. */
  movePolygonVertex: (index: number, latLng: [number, number]) => void
  /** Remove o vértice `index` do polígono atual (mínimo 3 vértices). */
  deletePolygonVertex: (index: number) => void
  /** Insere um vértice após `afterIndex` no polígono atual. */
  insertPolygonVertex: (afterIndex: number, latLng: [number, number]) => void
  /** Adiciona um waypoint manual na posição informada. */
  addManualWaypoint: (latLng: [number, number], altitude: number) => void
  /** Remove um waypoint pelo id. */
  removeWaypoint: (id: string) => void
  /** true quando qualquer waypoint tem `isManual === true`. */
  hasManualWaypoints: boolean
  /** Banner de "plano modificado manualmente" está visível. */
  manualWaypointsBannerVisible: boolean
  setManualWaypointsBannerVisible: (visible: boolean) => void
  /** Recalcula o plano descartando edições manuais (limpa isManual de todos os waypoints). */
  clearManualWaypoints: () => void
}

export const initialFlightParams: FlightParams = {
  droneModelId: null,
  /** Resolvido pelo catálogo + preferência de drone padrão em Configurações. */
  droneModel: '',
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
  frustum3dInDeck: true,
  setFrustum3dInDeck: (v) => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('flight:map3dFrustum', v ? '1' : '0')
      }
    } catch {
      /* ignore */
    }
    set({ frustum3dInDeck: v })
  },
  isCalculating: false,
  routeStartRef: null,
  draftPoints: [],
  plannerInteractionMode: 'draw',
  plannerBaseLayer: 'dark',
  hasManualWaypoints: false,
  manualWaypointsBannerVisible: false,
  setRouteStartRef: (routeStartRef) => set({ routeStartRef }),
  setDraftPoints: (draftPoints) => set({ draftPoints }),
  addDraftPoint: (point) =>
    set((state) => ({ draftPoints: [...state.draftPoints, point] })),
  popLastDraftPoint: () =>
    set((state) => ({
      draftPoints: state.draftPoints.slice(0, -1),
    })),
  closeDraft: () =>
    set((state) => {
      const closed = closeDraftToPolygon(state.draftPoints)
      if (!closed) return state
      return { polygon: closed, draftPoints: [] }
    }),
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
  setResult: (waypoints, stats, strips) =>
    set({ waypoints, stats, strips, hasManualWaypoints: waypoints.some((w) => w.isManual) }),
  setWeather: (weather, assessment) => set({ weather, assessment }),
  setIsCalculating: (value) => set({ isCalculating: value }),
  movePolygonVertex: (index, latLng) =>
    set((state) => {
      if (!state.polygon) return state
      const coords = [...state.polygon.geometry.coordinates[0]]
      const isClosingPoint = index === 0 || index === coords.length - 1
      coords[index] = [latLng[1], latLng[0]]
      // GeoJSON ring: first and last point must be identical
      if (isClosingPoint) {
        coords[0] = [latLng[1], latLng[0]]
        coords[coords.length - 1] = [latLng[1], latLng[0]]
      }
      return {
        polygon: {
          ...state.polygon,
          geometry: { ...state.polygon.geometry, coordinates: [coords] },
        },
      }
    }),
  deletePolygonVertex: (index) =>
    set((state) => {
      if (!state.polygon) return state
      const ring = state.polygon.geometry.coordinates[0]
      // ring[0] === ring[last] — work on the non-closing vertices
      const vertices = ring.slice(0, -1)
      if (vertices.length <= 3) return state // minimum 3 vertices
      const next = vertices.filter((_, i) => i !== index)
      const closed = [...next, next[0]!]
      return {
        polygon: {
          ...state.polygon,
          geometry: { ...state.polygon.geometry, coordinates: [closed] },
        },
      }
    }),
  insertPolygonVertex: (afterIndex, latLng) =>
    set((state) => {
      if (!state.polygon) return state
      const ring = state.polygon.geometry.coordinates[0]
      const vertices = ring.slice(0, -1)
      const newVertex = [latLng[1], latLng[0]] as [number, number]
      const next = [
        ...vertices.slice(0, afterIndex + 1),
        newVertex,
        ...vertices.slice(afterIndex + 1),
      ]
      const closed = [...next, next[0]!]
      return {
        polygon: {
          ...state.polygon,
          geometry: { ...state.polygon.geometry, coordinates: [closed] },
        },
      }
    }),
  addManualWaypoint: (latLng, altitude) =>
    set((state) => {
      const id = crypto.randomUUID()
      const index = state.waypoints.length
      const newWp: Waypoint = {
        id,
        lat: latLng[0],
        lng: latLng[1],
        altitude,
        altitudeMode: 'agl',
        gimbalPitch: -90,
        heading: 0,
        poiOverride: false,
        index,
        isManual: true,
      }
      const waypoints = [...state.waypoints, newWp]
      return { waypoints, hasManualWaypoints: true, manualWaypointsBannerVisible: true }
    }),
  removeWaypoint: (id) =>
    set((state) => {
      const waypoints = state.waypoints.filter((w) => w.id !== id)
      return { waypoints, hasManualWaypoints: waypoints.some((w) => w.isManual) }
    }),
  setManualWaypointsBannerVisible: (manualWaypointsBannerVisible) =>
    set({ manualWaypointsBannerVisible }),
  clearManualWaypoints: () =>
    set((state) => ({
      waypoints: state.waypoints.map((w) => ({ ...w, isManual: false })),
      hasManualWaypoints: false,
      manualWaypointsBannerVisible: false,
    })),
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
      frustum3dInDeck: true,
      hasManualWaypoints: false,
      manualWaypointsBannerVisible: false,
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
      hasManualWaypoints: false,
      manualWaypointsBannerVisible: false,
    }),
}))
