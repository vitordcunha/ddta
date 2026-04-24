import JSZip from 'jszip'
import type { FlightParams, Waypoint } from '@/features/flight-planner/types'

type KmlParams = {
  projectName: string
  params: FlightParams
}

export function buildTemplateKml(waypoints: Waypoint[], payload: KmlParams): string {
  const placemarks = waypoints
    .map(
      (waypoint, index) => `
      <Placemark>
        <name>WP-${index + 1}</name>
        <Point>
          <coordinates>${waypoint.lon},${waypoint.lat},${waypoint.altitudeM}</coordinates>
        </Point>
      </Placemark>`,
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${payload.projectName} - Template</name>
    <description>Drone: ${payload.params.droneModel}</description>
    ${placemarks}
  </Document>
</kml>`
}

export function buildWaylinesWpml(waypoints: Waypoint[], payload: KmlParams): string {
  const points = waypoints
    .map(
      (waypoint, index) => `
    <wpml:waypoint>
      <wpml:index>${index}</wpml:index>
      <wpml:longitude>${waypoint.lon}</wpml:longitude>
      <wpml:latitude>${waypoint.lat}</wpml:latitude>
      <wpml:height>${waypoint.altitudeM}</wpml:height>
      <wpml:speed>${payload.params.speedMs}</wpml:speed>
    </wpml:waypoint>`,
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<wpml:wayline xmlns:wpml="http://www.dji.com/wpmz/1.0.0">
  <wpml:missionConfig>
    <wpml:name>${payload.projectName}</wpml:name>
    <wpml:droneModel>${payload.params.droneModel}</wpml:droneModel>
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
