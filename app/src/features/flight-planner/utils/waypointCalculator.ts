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

export function generateFlightGrid(
  polygonGeoJSON: Feature<Polygon>,
  spacings: { sideSpacing: number; photoSpacing: number },
  rotationDeg: number,
): Strip[] {
  const bbox = turf.bbox(polygonGeoJSON)
  const center = turf.centerOfMass(polygonGeoJSON).geometry.coordinates
  const centerLat = center[1]
  const deltaLon = metersToDegreesLon(Math.max(spacings.sideSpacing, 3), centerLat)

  const rotated = turf.transformRotate(polygonGeoJSON, -rotationDeg, { pivot: center })
  const rotatedBBox = turf.bbox(rotated)
  const strips: Strip[] = []
  let stripIndex = 0

  for (let lon = rotatedBBox[0]; lon <= rotatedBBox[2]; lon += deltaLon) {
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

export function generateWaypoints(strips: Strip[], altitudeM: number): Waypoint[] {
  return strips.flatMap((strip, stripIndex) =>
    strip.coordinates.map((coordinate, pointIndex) => ({
      id: `${strip.id}-${pointIndex}`,
      lon: coordinate[0],
      lat: coordinate[1],
      altitudeM,
      stripIndex,
    })),
  )
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
    const current = turf.point([waypoints[i].lon, waypoints[i].lat])
    const next = turf.point([waypoints[i + 1].lon, waypoints[i + 1].lat])
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
