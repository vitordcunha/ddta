import { useMemo } from 'react'
import type { Layer } from '@deck.gl/core'
import type { PointOfInterest } from '@/features/flight-planner/types/poi'
import type { Waypoint } from '@/features/flight-planner/types/waypoint'
import { createDroneRouteLayer } from '@/features/map-engine/layers/DroneRouteLayer'
import { createPoiLayer } from '@/features/map-engine/layers/PoiLayer'
import { createWaypointLayer } from '@/features/map-engine/layers/WaypointLayer'

export type UseDroneRouteLayersInput = {
  waypoints: Waypoint[]
  showRoute: boolean
  showWaypoints: boolean
  poi: PointOfInterest | null
}

export function useDroneRouteLayers({
  waypoints,
  showRoute,
  showWaypoints,
  poi,
}: UseDroneRouteLayersInput): Layer[] {
  return useMemo(() => {
    const sorted = [...waypoints].sort((a, b) => a.index - b.index)
    const layers: Layer[] = []
    if (showRoute && sorted.length >= 2) {
      layers.push(createDroneRouteLayer(sorted))
    }
    if (showWaypoints && sorted.length > 0) {
      layers.push(createWaypointLayer(sorted))
    }
    if (poi) {
      layers.push(createPoiLayer(poi))
    }
    return layers
  }, [waypoints, showRoute, showWaypoints, poi])
}
