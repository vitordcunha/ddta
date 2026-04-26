import { useMemo } from 'react'
import { Layer, Source } from 'react-map-gl/mapbox'
import { useMapEngine } from '@/features/map-engine/useMapEngine'
import { useFlightStore } from '@/features/flight-planner/stores/useFlightStore'

type MapboxPlanOverlaysProps = {
  /** Em 2D: respeita toggles do painel. Em 3D a rota/waypoints vão para deck.gl (sempre false aqui). */
  nativeShowRoute: boolean
  nativeShowWaypoints: boolean
}

/** Pré-visualização somente leitura da área e rota no Mapbox (edição completa permanece no Leaflet até a fase 5/6). */
export function MapboxPlanOverlays({
  nativeShowRoute,
  nativeShowWaypoints,
}: MapboxPlanOverlaysProps) {
  const { mode } = useMapEngine()
  const polygon = useFlightStore((s) => s.polygon)
  const draftPoints = useFlightStore((s) => s.draftPoints)
  const waypoints = useFlightStore((s) => s.waypoints)
  const poi = useFlightStore((s) => s.poi)

  const draftLine = useMemo(() => {
    if (draftPoints.length < 2) return null
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: draftPoints.map(([lat, lng]) => [lng, lat]),
      },
    }
  }, [draftPoints])

  const routeLine = useMemo(() => {
    if (waypoints.length < 2) return null
    const sorted = [...waypoints].sort((a, b) => a.index - b.index)
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: sorted.map((w) => [w.lng, w.lat]),
      },
    }
  }, [waypoints])

  const wpPoints = useMemo(() => {
    if (waypoints.length === 0) return null
    const sorted = [...waypoints].sort((a, b) => a.index - b.index)
    return {
      type: 'FeatureCollection' as const,
      features: sorted.map((w, i, arr) => ({
        type: 'Feature' as const,
        properties: {
          role: i === 0 ? 'first' : i === arr.length - 1 ? 'last' : 'mid',
        },
        geometry: { type: 'Point' as const, coordinates: [w.lng, w.lat] },
      })),
    }
  }, [waypoints])

  const poiPoint = useMemo(() => {
    if (!poi || mode === '3d') return null
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'Point' as const, coordinates: [poi.lng, poi.lat] },
    }
  }, [poi, mode])

  return (
    <>
      {polygon ? (
        <Source id="dronedata-plan-polygon" type="geojson" data={polygon}>
          <Layer
            id="dronedata-plan-polygon-fill"
            type="fill"
            paint={{ 'fill-color': '#22c55e', 'fill-opacity': 0.2 }}
          />
          <Layer
            id="dronedata-plan-polygon-line"
            type="line"
            paint={{ 'line-color': '#4ade80', 'line-width': 2 }}
          />
        </Source>
      ) : null}

      {draftLine ? (
        <Source id="dronedata-plan-draft" type="geojson" data={draftLine}>
          <Layer
            id="dronedata-plan-draft-line"
            type="line"
            paint={{ 'line-color': '#fbbf24', 'line-width': 2, 'line-dasharray': [2, 2] }}
          />
        </Source>
      ) : null}

      {nativeShowRoute && routeLine ? (
        <Source id="dronedata-plan-route" type="geojson" data={routeLine}>
          <Layer
            id="dronedata-plan-route-line"
            type="line"
            paint={{ 'line-color': '#facc15', 'line-width': 3, 'line-opacity': 0.88 }}
          />
        </Source>
      ) : null}

      {nativeShowWaypoints && wpPoints ? (
        <Source id="dronedata-plan-waypoints" type="geojson" data={wpPoints}>
          <Layer
            id="dronedata-plan-waypoints-circle"
            type="circle"
            paint={{
              'circle-radius': 5,
              'circle-stroke-width': 2,
              'circle-stroke-color': '#0a0a0a',
              'circle-color': [
                'match',
                ['get', 'role'],
                'first',
                '#22c55e',
                'last',
                '#ef4444',
                '#fafafa',
              ],
            }}
          />
        </Source>
      ) : null}

      {poiPoint ? (
        <Source id="dronedata-plan-poi" type="geojson" data={poiPoint}>
          <Layer
            id="dronedata-plan-poi-circle"
            type="circle"
            paint={{
              'circle-radius': 9,
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ecfeff',
              'circle-color': '#06b6d4',
              'circle-opacity': 0.92,
            }}
          />
        </Source>
      ) : null}
    </>
  )
}
