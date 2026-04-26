export interface PointOfInterest {
  id: string
  lat: number
  lng: number
  /** Metros AMSL (alvo vertical do POI). */
  altitude: number
  label?: string
}

type LegacyPoi = {
  id?: string
  lat?: number
  lng?: number
  lon?: number
  altitude?: number
  label?: string
}

function waypointAmslApprox(w: {
  altitude: number
  altitudeMode: 'agl' | 'amsl'
  terrainElevation?: number
}): number {
  if (w.altitudeMode === 'amsl') return w.altitude
  return (w.terrainElevation ?? 0) + w.altitude
}

/** Altitude AMSL sugerida para um POI novo (mediana da aeronave na rota, ou AGL global + margem). */
export function defaultPoiAltitudeAmsl(
  waypoints: Array<{
    altitude: number
    altitudeMode: 'agl' | 'amsl'
    terrainElevation?: number
  }>,
  missionAltitudeM: number,
): number {
  if (!waypoints.length) return missionAltitudeM + 30
  const vals = waypoints.map(waypointAmslApprox).filter((n) => Number.isFinite(n))
  vals.sort((a, b) => a - b)
  return vals[Math.floor(vals.length / 2)]!
}

export function newPointOfInterest(
  lat: number,
  lng: number,
  waypoints: Parameters<typeof defaultPoiAltitudeAmsl>[0],
  missionAltitudeM: number,
  label?: string,
): PointOfInterest {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `poi-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  return {
    id,
    lat,
    lng,
    altitude: defaultPoiAltitudeAmsl(waypoints, missionAltitudeM),
    label,
  }
}

export function migratePoi(raw: unknown): PointOfInterest | null {
  if (raw == null) return null
  if (typeof raw !== 'object') return null
  const o = raw as LegacyPoi
  const lat = typeof o.lat === 'number' && Number.isFinite(o.lat) ? o.lat : null
  const lngRaw = typeof o.lng === 'number' && Number.isFinite(o.lng) ? o.lng : o.lon
  const lng = typeof lngRaw === 'number' && Number.isFinite(lngRaw) ? lngRaw : null
  if (lat == null || lng == null) return null
  const id =
    typeof o.id === 'string' && o.id.length > 0
      ? o.id
      : typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `poi-${Date.now()}`
  const altitude =
    typeof o.altitude === 'number' && Number.isFinite(o.altitude) ? o.altitude : 100
  const out: PointOfInterest = { id, lat, lng, altitude }
  if (typeof o.label === 'string' && o.label.length > 0) out.label = o.label
  return out
}
