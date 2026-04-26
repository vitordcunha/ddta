import * as turf from '@turf/turf'
import type { Feature, LineString, Polygon } from 'geojson'
import { getDroneSpec } from '@/features/flight-planner/utils/droneSpecs'
import type { DroneSpec, FlightParams, FlightStats, Strip, Waypoint } from '@/features/flight-planner/types'

type Footprint = { widthM: number; heightM: number }

export function calculateGsd(altitudeM: number, specs: DroneSpec): number {
  const altitudeMm = altitudeM * 1000
  return (altitudeMm * specs.sensorWidthMm) / (specs.focalLengthMm * specs.imageWidthPx) / 1000
}

export function calculateFootprint(gsdM: number, specs: DroneSpec): Footprint {
  return {
    widthM: gsdM * specs.imageWidthPx,
    heightM: gsdM * specs.imageHeightPx,
  }
}

export function calculateSpacings(footprint: Footprint, forwardOverlap: number, sideOverlap: number) {
  return {
    sideSpacing: footprint.widthM * (1 - sideOverlap / 100),
    photoSpacing: footprint.heightM * (1 - forwardOverlap / 100),
  }
}

function metersToDegreesLon(meters: number, latitude: number): number {
  return meters / (111320 * Math.cos((latitude * Math.PI) / 180))
}

export type FlightGridScanDirection = 'ltr' | 'rtl'

export type GenerateFlightGridOptions = {
  scanDirection?: FlightGridScanDirection
}

export function generateFlightGrid(
  polygonGeoJSON: Feature<Polygon>,
  spacings: { sideSpacing: number; photoSpacing: number },
  rotationDeg: number,
  options?: GenerateFlightGridOptions,
): Strip[] {
  const scanDirection = options?.scanDirection ?? 'ltr'
  const bbox = turf.bbox(polygonGeoJSON)
  const center = turf.centerOfMass(polygonGeoJSON).geometry.coordinates
  const centerLat = center[1]
  const deltaLon = metersToDegreesLon(Math.max(spacings.sideSpacing, 3), centerLat)

  const rotated = turf.transformRotate(polygonGeoJSON, -rotationDeg, { pivot: center })
  const rotatedBBox = turf.bbox(rotated)
  const strips: Strip[] = []
  let stripIndex = 0

  const lons: number[] = []
  for (let lon = rotatedBBox[0]; lon <= rotatedBBox[2]; lon += deltaLon) {
    lons.push(lon)
  }
  const orderedLons = scanDirection === 'rtl' ? [...lons].reverse() : lons

  for (const lon of orderedLons) {
    const scanLine = turf.lineString([
      [lon, rotatedBBox[1]],
      [lon, rotatedBBox[3]],
    ])
    const intersections = turf.lineIntersect(scanLine, rotated)
    const points = intersections.features
      .map((f) => f.geometry.coordinates as [number, number])
      .sort((a, b) => a[1] - b[1])

    for (let i = 0; i + 1 < points.length; i += 2) {
      const [start, end] = [points[i], points[i + 1]]
      const segment = turf.lineString([start, end])
      const finalSegment = turf.transformRotate(segment, rotationDeg, { pivot: center }) as Feature<LineString>
      const coords = finalSegment.geometry.coordinates as [number, number][]

      strips.push({
        id: `strip-${stripIndex}`,
        coordinates: stripIndex % 2 === 0 ? coords : [...coords].reverse(),
      })
      stripIndex += 1
    }
  }

  if (strips.length === 0 && bbox) {
    const fallback = turf.transformRotate(
      turf.lineString([
        [bbox[0], bbox[1]],
        [bbox[2], bbox[3]],
      ]),
      rotationDeg,
      { pivot: center },
    ) as Feature<LineString>
    strips.push({ id: 'strip-0', coordinates: fallback.geometry.coordinates as [number, number][] })
  }

  return strips
}

function newWaypointId(index: number): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `wp-${index}-${Math.random().toString(36).slice(2, 9)}`
}

export function generateWaypoints(strips: Strip[], altitudeM: number): Waypoint[] {
  const coords = strips.flatMap((strip) => strip.coordinates)
  return coords.map((coordinate, index) => {
    const toward = coords[index + 1] ?? coords[index - 1]
    let heading = 0
    if (toward) {
      const bearing = turf.bearing(
        turf.point([coordinate[0], coordinate[1]]),
        turf.point([toward[0], toward[1]]),
      )
      heading = ((bearing % 360) + 360) % 360
    }
    return {
      id: newWaypointId(index),
      lat: coordinate[1],
      lng: coordinate[0],
      altitude: altitudeM,
      altitudeMode: 'agl' as const,
      gimbalPitch: -90,
      heading,
      poiOverride: false,
      index,
    }
  })
}

export type RouteStartRefLngLat = { lat: number; lng: number }

function distanceMetersToFirstWaypoint(user: RouteStartRefLngLat, waypoints: Waypoint[]): number {
  if (waypoints.length === 0) {
    return Number.POSITIVE_INFINITY
  }
  const from = turf.point([user.lng, user.lat])
  const to = turf.point([waypoints[0]!.lng, waypoints[0]!.lat])
  return turf.distance(from, to, { units: 'kilometers' }) * 1000
}

function withReindexedWaypointIds(waypoints: Waypoint[]): Waypoint[] {
  return waypoints.map((w, i) => ({
    ...w,
    id: `wp-${i}`,
    index: i,
  }))
}

/**
 * Escolhe ordem das faixas (LTR/RTL), sentido do zigue-zague e inversao do percurso
 * para que o primeiro waypoint fique o mais proximo possivel da posicao de referencia.
 */
export function optimizeFlightPlanStart(
  polygonGeoJSON: Feature<Polygon>,
  spacings: { sideSpacing: number; photoSpacing: number },
  rotationDeg: number,
  altitudeM: number,
  userLngLat: RouteStartRefLngLat,
): { strips: Strip[]; waypoints: Waypoint[] } {
  let best: { strips: Strip[]; waypoints: Waypoint[]; dist: number } | null = null

  for (const scanDirection of ['ltr', 'rtl'] as const) {
    const strips = generateFlightGrid(polygonGeoJSON, spacings, rotationDeg, { scanDirection })
    if (strips.length === 0) {
      continue
    }
    for (const reversePath of [false, true]) {
      const base = generateWaypoints(strips, altitudeM)
      const waypoints = reversePath ? withReindexedWaypointIds([...base].reverse()) : base
      const dist = distanceMetersToFirstWaypoint(userLngLat, waypoints)
      if (!best || dist < best.dist) {
        best = { strips, waypoints, dist }
      }
    }
  }

  const fallbackStrips = generateFlightGrid(polygonGeoJSON, spacings, rotationDeg)
  const fallbackWaypoints = generateWaypoints(fallbackStrips, altitudeM)
  if (!best) {
    return { strips: fallbackStrips, waypoints: fallbackWaypoints }
  }

  return { strips: best.strips, waypoints: best.waypoints }
}

/**
 * Calcula o angulo de rotacao otimo considerando:
 *  1. Minimizar numero de faixas (prioridade)
 *  2. Minimizar distancia total de voo + distancia de aproximacao do usuario ao 1o waypoint
 *
 * Quando `userLngLat` e fornecido, testa as 4 combinacoes de inicio (LTR/RTL x
 * forward/reverse) para cada angulo candidato e incorpora a distancia de aproximacao
 * no custo total, ponderada por 0.3 (custo unico vs custo recorrente do voo).
 *
 * Usa busca exaustiva em dois passos: coarse (5°) + fine (1°) em torno do melhor.
 * Retorna angulo em graus [0, 180).
 */
export function calculateOptimalRotation(
  polygonGeoJSON: Feature<Polygon>,
  spacings: { sideSpacing: number; photoSpacing: number },
  altitudeM = 100,
  userLngLat?: RouteStartRefLngLat,
): number {
  /** Comprimento total em metros das faixas geradas */
  const flightDistanceM = (strips: Strip[]): number => {
    let dist = 0
    for (const strip of strips) {
      for (let i = 0; i < strip.coordinates.length - 1; i++) {
        const [x0, y0] = strip.coordinates[i]!
        const [x1, y1] = strip.coordinates[i + 1]!
        const dlat = (y1 - y0) * 111320
        const dlon = (x1 - x0) * 111320 * Math.cos((y0 * Math.PI) / 180)
        dist += Math.sqrt(dlat * dlat + dlon * dlon)
      }
    }
    return dist
  }

  /**
   * Avalia um angulo: retorna (nFaixas, custoTotal).
   * Quando ha posicao do usuario, testa as 4 combinacoes de inicio e escolhe a
   * que minimiza flightDist + 0.3 * approachDist.
   */
  const evaluate = (angle: number): { strips: number; cost: number } => {
    if (userLngLat) {
      let bestCost = Infinity
      let bestStrips = 0

      for (const scanDirection of ['ltr', 'rtl'] as const) {
        const strips = generateFlightGrid(polygonGeoJSON, spacings, angle, { scanDirection })
        if (strips.length === 0) continue
        const flightDist = flightDistanceM(strips)

        for (const reversePath of [false, true]) {
          const base = generateWaypoints(strips, altitudeM)
          const wps = reversePath ? withReindexedWaypointIds([...base].reverse()) : base
          const approachDist = distanceMetersToFirstWaypoint(userLngLat, wps)
          const cost = flightDist + 0.3 * approachDist
          if (cost < bestCost) {
            bestCost = cost
            bestStrips = strips.length
          }
        }
      }

      return bestStrips > 0 ? { strips: bestStrips, cost: bestCost } : { strips: Infinity, cost: Infinity }
    }

    // Sem posicao do usuario: minimiza apenas distancia de voo
    const strips = generateFlightGrid(polygonGeoJSON, spacings, angle)
    if (strips.length === 0) return { strips: Infinity, cost: Infinity }
    return { strips: strips.length, cost: flightDistanceM(strips) }
  }

  // Passo 1: busca coarse em passos de 5°
  let bestAngle = 0
  let bestStrips = Infinity
  let bestCost = Infinity

  for (let angle = 0; angle < 180; angle += 5) {
    const { strips, cost } = evaluate(angle)
    if (strips < bestStrips || (strips === bestStrips && cost < bestCost)) {
      bestStrips = strips
      bestCost = cost
      bestAngle = angle
    }
  }

  // Passo 2: refino ±6° em torno do melhor (passo 1°)
  const lo = Math.max(0, bestAngle - 6)
  const hi = Math.min(179, bestAngle + 6)
  for (let angle = lo; angle <= hi; angle++) {
    const { strips, cost } = evaluate(angle)
    if (strips < bestStrips || (strips === bestStrips && cost < bestCost)) {
      bestStrips = strips
      bestCost = cost
      bestAngle = angle
    }
  }

  return bestAngle
}

export function calculateStats(
  waypoints: Waypoint[],
  polygon: Feature<Polygon>,
  params: FlightParams,
  strips: Strip[],
): FlightStats {
  const specs = getDroneSpec(params.droneModel)
  const gsdM = calculateGsd(params.altitudeM, specs)
  const footprint = calculateFootprint(gsdM, specs)
  const spacing = calculateSpacings(footprint, params.forwardOverlap, params.sideOverlap)
  const areaHa = turf.area(polygon) / 10000

  let distanceKm = 0
  for (let i = 0; i < waypoints.length - 1; i += 1) {
    const current = turf.point([waypoints[i].lng, waypoints[i].lat])
    const next = turf.point([waypoints[i + 1].lng, waypoints[i + 1].lat])
    distanceKm += turf.distance(current, next, { units: 'kilometers' })
  }

  const estimatedTimeMin = (distanceKm * 1000) / Math.max(params.speedMs, 1) / 60
  const batteryCount = Math.max(1, Math.ceil(estimatedTimeMin / specs.batteryTimeMin))
  const photosPerStrip = strips.reduce((sum, strip) => {
    const line = turf.lineString(strip.coordinates)
    const stripDistanceM = turf.length(line, { units: 'kilometers' }) * 1000
    return sum + Math.max(1, Math.ceil(stripDistanceM / Math.max(spacing.photoSpacing, 1)))
  }, 0)

  return {
    gsdCm: gsdM * 100,
    areaHa,
    waypointCount: waypoints.length,
    stripCount: strips.length,
    estimatedPhotos: photosPerStrip,
    estimatedTimeMin,
    batteryCount,
    distanceKm,
  }
}
