export type { PointOfInterest } from '@/features/flight-planner/types/poi'

export type Waypoint = {
  id: string
  lat: number
  lng: number
  /** Metros AMSL ou AGL conforme `altitudeMode`. */
  altitude: number
  altitudeMode: 'agl' | 'amsl'
  terrainElevation?: number
  /** Graus, -90 (nadir) a 0 (horizonte). */
  gimbalPitch: number
  /** Graus, 0–359, sentido do drone. */
  heading: number
  /** Se true, ignora POI global e usa gimbal/heading deste waypoint. */
  poiOverride: boolean
  speed?: number
  hoverTime?: number
  index: number
  /**
   * Se o operador ajustou a altitude manualmente; o terrain-following
   * não recalcula a altitude (apenas `terrainElevation` de exibição).
   */
  manualAltitude?: boolean
}

type LegacyWaypoint = {
  id?: string
  lat: number
  lon?: number
  lng?: number
  altitude?: number
  altitudeM?: number
  altitudeMode?: Waypoint['altitudeMode']
  terrainElevation?: number
  gimbalPitch?: number
  heading?: number
  poiOverride?: boolean
  speed?: number
  hoverTime?: number
  index?: number
  manualAltitude?: boolean
}

function clampHeading(deg: number): number {
  let h = deg % 360
  if (h < 0) h += 360
  return h
}

export function migrateWaypoint(raw: unknown, indexFallback = 0): Waypoint | null {
  if (!raw || typeof raw !== 'object') return null
  const w = raw as LegacyWaypoint
  if (typeof w.lat !== 'number' || !Number.isFinite(w.lat)) return null
  const lng = typeof w.lng === 'number' ? w.lng : w.lon
  if (typeof lng !== 'number' || !Number.isFinite(lng)) return null

  const altitude =
    typeof w.altitude === 'number' && Number.isFinite(w.altitude)
      ? w.altitude
      : typeof w.altitudeM === 'number' && Number.isFinite(w.altitudeM)
        ? w.altitudeM
        : 0

  const altitudeMode = w.altitudeMode === 'amsl' || w.altitudeMode === 'agl' ? w.altitudeMode : 'agl'
  const gimbalPitch =
    typeof w.gimbalPitch === 'number' && Number.isFinite(w.gimbalPitch) ? w.gimbalPitch : -90
  const heading =
    typeof w.heading === 'number' && Number.isFinite(w.heading) ? clampHeading(w.heading) : 0
  const poiOverride = Boolean(w.poiOverride)
  const index = typeof w.index === 'number' && Number.isFinite(w.index) ? Math.round(w.index) : indexFallback
  const id =
    typeof w.id === 'string' && w.id.length > 0
      ? w.id
      : typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `wp-${index}-${Math.random().toString(36).slice(2, 9)}`

  const out: Waypoint = {
    id,
    lat: w.lat,
    lng,
    altitude,
    altitudeMode,
    gimbalPitch,
    heading,
    poiOverride,
    index,
  }
  if (typeof w.terrainElevation === 'number' && Number.isFinite(w.terrainElevation)) {
    out.terrainElevation = w.terrainElevation
  }
  if (typeof w.speed === 'number' && Number.isFinite(w.speed)) out.speed = w.speed
  if (typeof w.hoverTime === 'number' && Number.isFinite(w.hoverTime)) out.hoverTime = w.hoverTime
  if (typeof w.manualAltitude === 'boolean') out.manualAltitude = w.manualAltitude
  return out
}

export function migrateWaypoints(raw: unknown[] | undefined): Waypoint[] {
  if (!raw?.length) return []
  return raw
    .map((item, i) => migrateWaypoint(item, i))
    .filter((w): w is Waypoint => w !== null)
    .map((w, i) => ({ ...w, index: i }))
}
