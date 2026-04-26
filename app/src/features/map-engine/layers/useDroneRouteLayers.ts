import { useMemo } from 'react'
import type { Layer } from '@deck.gl/core'
import type { PointOfInterest } from '@/features/flight-planner/types/poi'
import type { Waypoint } from '@/features/flight-planner/types/waypoint'
import type { DroneCameraParams } from '@/features/flight-planner/utils/defaultDroneCamera'
import { computeFrustumGeometry } from '@/features/flight-planner/utils/frustumCalculator'
import { createDroneRouteLayer } from '@/features/map-engine/layers/DroneRouteLayer'
import { createFrustumLayers } from '@/features/map-engine/layers/FrustumLayer'
import { createPoiLayer } from '@/features/map-engine/layers/PoiLayer'
import { createWaypointLayer } from '@/features/map-engine/layers/WaypointLayer'
import type { DeviceTier } from '@/features/map-engine/utils/detectDeviceTier'

export type UseDroneRouteLayersInput = {
  waypoints: Waypoint[]
  showRoute: boolean
  showWaypoints: boolean
  poi: PointOfInterest | null
  /** Waypoint selecionado: campo de visão no deck (2D = só footprint; 3D = cone completo). */
  frustumWaypoint: Waypoint | null
  /**
   * true: rota, waypoints e POI vão para o deck (modo 3D Mapbox).
   * false: mapa nativo/Leaflet desenha o plano; o deck só leva o frustum, se houver.
   */
  deckPlanGeometry: boolean
  /** ID do waypoint selecionado (para updateTriggers de cor). */
  selectedWaypointId?: string | null
  /** Tier do dispositivo para LOD (O.5). */
  deviceTier?: DeviceTier
  /** O.7: se false, não cria `FrustumLayer` (POI/POI+rota inalterados). */
  showFrustum3d?: boolean
  /** FOV do modelo ativo (Fase 9); omitido usa fallback Mavic 3. */
  droneCamera?: DroneCameraParams
}

/**
 * Reduz marcadores 3D em dispositivos low (O.5). Acima de 200 waypoints, amostra ~150
 * pontos. A rota (PathLayer) sempre usa todos os pontos.
 */
function applyLOD(waypoints: Waypoint[], tier: DeviceTier): Waypoint[] {
  if (tier === 'high' || waypoints.length <= 200) return waypoints
  const step = Math.ceil(waypoints.length / 150)
  return waypoints.filter((_, i) => i % step === 0 || i === 0 || i === waypoints.length - 1)
}

export function useDroneRouteLayers({
  waypoints,
  showRoute,
  showWaypoints,
  poi,
  frustumWaypoint,
  deckPlanGeometry,
  selectedWaypointId,
  deviceTier = 'high',
  showFrustum3d = true,
  droneCamera,
}: UseDroneRouteLayersInput): Layer[] {
  return useMemo(() => {
    const sorted = [...waypoints].sort((a, b) => a.index - b.index)
    const layers: Layer[] = []

    if (deckPlanGeometry) {
      if (showRoute && sorted.length >= 2) {
        layers.push(createDroneRouteLayer(sorted))
      }
    }

    const frustumW =
      showFrustum3d && deckPlanGeometry && frustumWaypoint ? frustumWaypoint : null
    const frustumGeom = frustumW
      ? computeFrustumGeometry(frustumW, droneCamera)
      : null
    if (frustumGeom) {
      layers.push(...createFrustumLayers(frustumGeom, { includeSides: true }))
    }

    if (deckPlanGeometry) {
      if (showWaypoints && sorted.length > 0) {
        const lodWaypoints = applyLOD(sorted, deviceTier)
        layers.push(createWaypointLayer(lodWaypoints, selectedWaypointId))
      }
      if (poi) {
        layers.push(createPoiLayer(poi))
      }
    }

    return layers
  }, [
    waypoints,
    showRoute,
    showWaypoints,
    poi,
    frustumWaypoint,
    showFrustum3d,
    deckPlanGeometry,
    selectedWaypointId,
    deviceTier,
    droneCamera?.fovHorizontalDeg,
    droneCamera?.fovVerticalDeg,
  ])
}
