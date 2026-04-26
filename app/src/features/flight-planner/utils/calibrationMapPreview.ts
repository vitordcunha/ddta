import * as turf from '@turf/turf'
import type { FlightParams, Waypoint } from '@/features/flight-planner/types'
import { getDroneSpec } from '@/features/flight-planner/utils/droneSpecs'
import { calculateFootprint, calculateGsd } from '@/features/flight-planner/utils/waypointCalculator'

/** Anel Leaflet [lat, lng] por foto (footprint retangular alinhado à rota). */
export type PhotoPreviewRing = {
  id: string
  /** [lat, lng] fechado */
  ringLatLng: [number, number][]
  /** 0–1 para cor no mapa */
  t: number
}

function offsetMeters(
  lon: number,
  lat: number,
  deM: number,
  dnM: number,
  cosLatRef: number,
): { lon: number; lat: number } {
  return {
    lon: lon + deM / (111320 * Math.max(Math.abs(cosLatRef), 0.01)),
    lat: lat + dnM / 111320,
  }
}

/**
 * Retângulos aproximados no solo por waypoint (GSD + sensor), orientados ao segmento seguinte da rota.
 */
export function buildCalibrationWaypointFootprintRings(
  waypoints: Waypoint[],
  params: FlightParams,
  centerLat: number,
): PhotoPreviewRing[] {
  if (waypoints.length === 0) return []
  const specs = getDroneSpec(params.droneModel)
  const gsdM = calculateGsd(params.altitudeM, specs)
  const fp = calculateFootprint(gsdM, specs)
  const halfW = fp.widthM / 2
  const halfH = fp.heightM / 2
  const cosLatRef = Math.cos((centerLat * Math.PI) / 180)

  const n = waypoints.length
  const rings: PhotoPreviewRing[] = []

  for (let i = 0; i < n; i++) {
    const w = waypoints[i]!
    const next = waypoints[i + 1]
    const prev = waypoints[i - 1]
    const toward = next ?? prev
    if (!toward) continue

    const bearingDeg = turf.bearing(
      turf.point([w.lng, w.lat]),
      turf.point([toward.lng, toward.lat]),
    )
    const b = (bearingDeg * Math.PI) / 180

    const cornerOffsets: [number, number][] = [
      [-halfW, -halfH],
      [halfW, -halfH],
      [halfW, halfH],
      [-halfW, halfH],
      [-halfW, -halfH],
    ]
    const ring: [number, number][] = cornerOffsets.map(([rightM, fwdM]) => {
      const deM = fwdM * Math.sin(b) + rightM * Math.cos(b)
      const dnM = fwdM * Math.cos(b) - rightM * Math.sin(b)
      const p = offsetMeters(w.lng, w.lat, deM, dnM, cosLatRef)
      return [p.lat, p.lon] as [number, number]
    })
    rings.push({
      id: w.id,
      ringLatLng: ring,
      t: n > 1 ? i / (n - 1) : 0,
    })
  }

  return rings
}
