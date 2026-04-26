import JSZip from 'jszip'
import type { FlightParams, PointOfInterest, Waypoint } from '@/features/flight-planner/types'

export type KmzVariant = 'full' | 'calibration'

type KmlParams = {
  projectName: string
  params: FlightParams
  /** Missão completa ou recorte de calibração (nome e descrição no KML/WPML). */
  variant?: KmzVariant
  /** POI global; quando definido e o waypoint não tem `poiOverride`, usa modo towardPOI. */
  poi?: PointOfInterest | null
}

function wpmlHeadingMode(w: Waypoint, poi: PointOfInterest | null | undefined): string {
  if (w.poiOverride) return 'fixed'
  if (poi) return 'towardPOI'
  return 'fixed'
}

function missionDisplayName(projectName: string, variant: KmzVariant | undefined): string {
  if (variant === 'calibration') {
    return `${projectName} — Calibração`
  }
  return projectName
}

export function buildTemplateKml(waypoints: Waypoint[], payload: KmlParams): string {
  const placemarks = waypoints
    .map(
      (waypoint, index) => `
      <Placemark>
        <name>WP-${index + 1}</name>
        <Point>
          <coordinates>${waypoint.lng},${waypoint.lat},${waypoint.altitude}</coordinates>
        </Point>
      </Placemark>`,
    )
    .join('\n')

  const display = missionDisplayName(payload.projectName, payload.variant)
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${display} - Template</name>
    <description>Drone: ${payload.params.droneModel}${payload.variant === 'calibration' ? ' | Voo de calibração' : ''}</description>
    ${placemarks}
  </Document>
</kml>`
}

export function buildWaylinesWpml(waypoints: Waypoint[], payload: KmlParams): string {
  const poi = payload.poi ?? null
  const points = waypoints
    .map(
      (waypoint, index) => `
    <wpml:waypoint>
      <wpml:index>${index}</wpml:index>
      <wpml:longitude>${waypoint.lng}</wpml:longitude>
      <wpml:latitude>${waypoint.lat}</wpml:latitude>
      <wpml:height>${waypoint.altitude}</wpml:height>
      <wpml:speed>${payload.params.speedMs}</wpml:speed>
      <wpml:gimbalPitchAngle>${waypoint.gimbalPitch}</wpml:gimbalPitchAngle>
      <wpml:waypointHeadingMode>${wpmlHeadingMode(waypoint, poi)}</wpml:waypointHeadingMode>
      <wpml:waypointHeadingAngle>${waypoint.heading}</wpml:waypointHeadingAngle>${
        waypoint.speed != null
          ? `
      <wpml:waypointSpeed>${waypoint.speed}</wpml:waypointSpeed>`
          : ''
      }
    </wpml:waypoint>`,
    )
    .join('\n')

  const display = missionDisplayName(payload.projectName, payload.variant)
  const poiXml =
    poi != null
      ? `
    <wpml:pointOfInterest>
      <wpml:longitude>${poi.lng}</wpml:longitude>
      <wpml:latitude>${poi.lat}</wpml:latitude>
      <wpml:height>${poi.altitude}</wpml:height>
    </wpml:pointOfInterest>`
      : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<wpml:wayline xmlns:wpml="http://www.dji.com/wpmz/1.0.0">
  <wpml:missionConfig>
    <wpml:name>${display}</wpml:name>
    <wpml:droneModel>${payload.params.droneModel}</wpml:droneModel>${poiXml}
  </wpml:missionConfig>
  <wpml:waypoints>
    ${points}
  </wpml:waypoints>
</wpml:wayline>`
}

export async function generateKmz(waypoints: Waypoint[], payload: KmlParams): Promise<Blob> {
  const zip = new JSZip()
  zip.file('template.kml', buildTemplateKml(waypoints, payload))
  zip.file('waylines.wpml', buildWaylinesWpml(waypoints, payload))
  return zip.generateAsync({ type: 'blob' })
}
