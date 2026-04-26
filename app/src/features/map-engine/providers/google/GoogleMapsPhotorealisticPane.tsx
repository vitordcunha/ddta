import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Feature, Polygon } from 'geojson'
import {
  closeDraftToPolygon,
  isClickNearFirstVertex,
} from '@/features/flight-planner/utils/polygonDraft'
import { newPointOfInterest } from '@/features/flight-planner/types/poi'
import { useFlightStore } from '@/features/flight-planner/stores/useFlightStore'
import type { Waypoint } from '@/features/flight-planner/types/waypoint'
import {
  cameraRangeMetersToZoomLevel,
  zoomLevelToCameraRangeMeters,
} from '@/features/map-engine/providers/google/googleMapsZoomRange'

export type Map3DElementInstance = HTMLElement & {
  mode?: string
  mapId?: string
  center?: google.maps.LatLngAltitudeLiteral
  range?: number
  tilt?: number
  heading?: number
  gestureHandling?: string
}

type Polyline3DInstance = HTMLElement & {
  path?: string
  strokeColor?: string
  strokeWidth?: number
  geodesic?: boolean
  altitudeMode?: string
  drawsOccludedSegments?: boolean
}

type Polygon3DInstance = HTMLElement & {
  path?: string
  strokeColor?: string
  strokeWidth?: number
  fillColor?: string
  geodesic?: boolean
  altitudeMode?: string
  extruded?: boolean
  drawsOccludedSegments?: boolean
}

type Maps3dImport = {
  Map3DElement: new (opts?: Record<string, unknown>) => Map3DElementInstance
  Polyline3DElement: new (opts?: Record<string, unknown>) => Polyline3DInstance
  Polygon3DElement: new (opts?: Record<string, unknown>) => Polygon3DInstance
}

function formatLatLngAltPath(points: { lat: number; lng: number; altitude: number }[]): string {
  return points.map((p) => `${p.lat},${p.lng},${p.altitude}`).join(' ')
}

function polygonToPath3d(polygon: Feature<Polygon>): string | null {
  const ring = polygon.geometry.coordinates[0]
  if (!ring?.length) return null
  const triples = ring.map(([lng, lat]) => ({ lat, lng, altitude: 0 }))
  return formatLatLngAltPath(triples)
}

function sortedWaypoints(waypoints: Waypoint[]): Waypoint[] {
  return [...waypoints].sort((a, b) => a.index - b.index)
}

type GoogleMapsPhotorealisticPaneProps = {
  center: [number, number]
  zoom: number
  mapId?: string
  showPlan: boolean
  onViewportFromCamera: (center: [number, number], zoom: number) => void
  onMap3dElementChange: (el: Map3DElementInstance | null) => void
  onLoadError: () => void
}

/**
 * Mapa imersivo 3D (modo HYBRID) via `importLibrary("maps3d")`.
 * Missão: Polygon3D + Polyline3D; desenho de área espelhando o Leaflet.
 */
export function GoogleMapsPhotorealisticPane({
  center,
  zoom,
  mapId,
  showPlan,
  onViewportFromCamera,
  onMap3dElementChange,
  onLoadError,
}: GoogleMapsPhotorealisticPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const map3dRef = useRef<Map3DElementInstance | null>(null)
  const routeRef = useRef<Polyline3DInstance | null>(null)
  const draftRef = useRef<Polyline3DInstance | null>(null)
  const polygonRef = useRef<Polygon3DInstance | null>(null)
  const applyingFromContext = useRef(false)
  const lastContextCenter = useRef<[number, number] | null>(null)
  const lastContextZoom = useRef<number | null>(null)
  const [ready, setReady] = useState(false)

  const onViewportRef = useRef(onViewportFromCamera)
  const onMap3dChangeRef = useRef(onMap3dElementChange)
  const onLoadErrorRef = useRef(onLoadError)
  useLayoutEffect(() => {
    onViewportRef.current = onViewportFromCamera
    onMap3dChangeRef.current = onMap3dElementChange
    onLoadErrorRef.current = onLoadError
  }, [onLoadError, onMap3dElementChange, onViewportFromCamera])

  const polygon = useFlightStore((s) => s.polygon)
  const draftPoints = useFlightStore((s) => s.draftPoints)
  const waypoints = useFlightStore((s) => s.waypoints)
  const deckVis = useFlightStore((s) => s.deckMapVisibility.plan)

  const removeOverlay = (node: HTMLElement | null) => {
    if (node?.parentNode) node.parentNode.removeChild(node)
  }

  const centerRef = useRef(center)
  const zoomRef = useRef(zoom)
  useLayoutEffect(() => {
    centerRef.current = center
    zoomRef.current = zoom
  }, [center, zoom])

  useEffect(() => {
    const root = containerRef.current
    if (!root) return
    let cancelled = false
    let detachCameraListeners: (() => void) | undefined

    void (async () => {
      try {
        const lib = (await google.maps.importLibrary(
          'maps3d',
        )) as unknown as Maps3dImport
        if (cancelled || !containerRef.current) return

        const c = centerRef.current
        const z = zoomRef.current
        const el = new lib.Map3DElement({
          mode: 'HYBRID',
          center: { lat: c[0], lng: c[1], altitude: 0 },
          tilt: 62,
          range: zoomLevelToCameraRangeMeters(z, c[0], window.innerHeight),
          heading: 0,
          gestureHandling: 'greedy',
        })
        if (mapId) el.mapId = mapId

        containerRef.current.appendChild(el)
        map3dRef.current = el
        onMap3dChangeRef.current(el)
        lastContextCenter.current = [c[0], c[1]]
        lastContextZoom.current = z
        setReady(true)

        const pushViewport = () => {
          if (applyingFromContext.current) return
          const c = el.center
          const r = el.range
          if (!c || typeof r !== 'number') return
          const z = cameraRangeMetersToZoomLevel(
            r,
            c.lat ?? centerRef.current[0],
            window.innerHeight,
          )
          lastContextCenter.current = [c.lat, c.lng]
          lastContextZoom.current = z
          onViewportRef.current([c.lat, c.lng], z)
        }

        let debounceTimer: number | undefined
        const debouncedPush = () => {
          if (debounceTimer !== undefined) window.clearTimeout(debounceTimer)
          debounceTimer = window.setTimeout(() => {
            debounceTimer = undefined
            pushViewport()
          }, 120)
        }

        el.addEventListener('gmp-centerchange', debouncedPush)
        el.addEventListener('gmp-rangechange', debouncedPush)
        detachCameraListeners = () => {
          if (debounceTimer !== undefined) window.clearTimeout(debounceTimer)
          el.removeEventListener('gmp-centerchange', debouncedPush)
          el.removeEventListener('gmp-rangechange', debouncedPush)
        }
      } catch {
        if (!cancelled) onLoadErrorRef.current()
      }
    })()

    return () => {
      cancelled = true
      detachCameraListeners?.()
      removeOverlay(routeRef.current)
      routeRef.current = null
      removeOverlay(draftRef.current)
      draftRef.current = null
      removeOverlay(polygonRef.current)
      polygonRef.current = null
      const el = map3dRef.current
      map3dRef.current = null
      if (el?.parentNode) el.parentNode.removeChild(el)
      onMap3dChangeRef.current(null)
      lastContextCenter.current = null
      lastContextZoom.current = null
      setReady(false)
    }
  }, [mapId])

  useEffect(() => {
    const el = map3dRef.current
    if (!el || !ready) return

    const lc = lastContextCenter.current
    const lz = lastContextZoom.current
    const sameCenter =
      lc &&
      Math.abs(lc[0] - center[0]) < 1e-7 &&
      Math.abs(lc[1] - center[1]) < 1e-7 &&
      lz === zoom
    if (sameCenter) return

    applyingFromContext.current = true
    el.center = { lat: center[0], lng: center[1], altitude: 0 }
    el.range = zoomLevelToCameraRangeMeters(zoom, center[0], window.innerHeight)
    if (mapId) el.mapId = mapId
    lastContextCenter.current = [center[0], center[1]]
    lastContextZoom.current = zoom
    const id = window.setTimeout(() => {
      applyingFromContext.current = false
    }, 180)
    return () => window.clearTimeout(id)
  }, [center, zoom, mapId, ready])

  useEffect(() => {
    const parent = map3dRef.current
    if (!parent || !ready) return

    void (async () => {
      const lib = (await google.maps.importLibrary('maps3d')) as unknown as Maps3dImport

      removeOverlay(routeRef.current)
      routeRef.current = null
      if (deckVis.showRoute && waypoints.length >= 2) {
        const sorted = sortedWaypoints(waypoints)
        const pts = sorted.map((w) => ({
          lat: w.lat,
          lng: w.lng,
          altitude: Math.max(0, w.altitude),
        }))
        const pl = new lib.Polyline3DElement({
          path: formatLatLngAltPath(pts),
          strokeColor: '#facc15',
          strokeWidth: 3,
          geodesic: true,
          altitudeMode: 'RELATIVE_TO_GROUND',
          drawsOccludedSegments: true,
        })
        parent.appendChild(pl)
        routeRef.current = pl
      }

      removeOverlay(draftRef.current)
      draftRef.current = null
      if (draftPoints.length >= 2) {
        const pts = draftPoints.map(([lat, lng]) => ({ lat, lng, altitude: 0 }))
        const pl = new lib.Polyline3DElement({
          path: formatLatLngAltPath(pts),
          strokeColor: '#fbbf24',
          strokeWidth: 2,
          geodesic: false,
          altitudeMode: 'CLAMP_TO_GROUND',
        })
        parent.appendChild(pl)
        draftRef.current = pl
      }

      removeOverlay(polygonRef.current)
      polygonRef.current = null
      if (polygon?.geometry?.type === 'Polygon') {
        const path = polygonToPath3d(polygon as Feature<Polygon>)
        if (path) {
          const poly = new lib.Polygon3DElement({
            path,
            strokeColor: '#4ade80',
            strokeWidth: 2,
            fillColor: 'rgba(34,197,94,0.22)',
            geodesic: false,
            altitudeMode: 'CLAMP_TO_GROUND',
            extruded: false,
            drawsOccludedSegments: false,
          })
          parent.appendChild(poly)
          polygonRef.current = poly
        }
      }
    })()
  }, [deckVis.showRoute, draftPoints, polygon, ready, waypoints])

  useEffect(() => {
    const el = map3dRef.current
    if (!el || !showPlan || !ready) return

    const onClick = (ev: Event) => {
      const e = ev as CustomEvent<{ position?: google.maps.LatLngAltitudeLiteral }>
      const pos = e.detail?.position
      if (!pos) return

      const st = useFlightStore.getState()
      if (st.poiPlacementActive) {
        const lat = pos.lat
        const lng = pos.lng
        if (st.poi) {
          st.setPoi({ ...st.poi, lat, lng })
        } else {
          st.setPoi(newPointOfInterest(lat, lng, st.waypoints, st.params.altitudeM))
        }
        return
      }
      if (st.plannerInteractionMode !== 'draw') return
      const latlng: [number, number] = [pos.lat, pos.lng]
      const { draftPoints: dps, addDraftPoint, setDraftPoints, setPolygon } = st
      if (isClickNearFirstVertex(latlng, dps)) {
        const closed = closeDraftToPolygon(dps)
        if (closed) {
          setPolygon(closed)
          setDraftPoints([])
        }
        return
      }
      addDraftPoint(latlng)
    }

    el.addEventListener('gmp-click', onClick)
    return () => {
      el.removeEventListener('gmp-click', onClick)
    }
  }, [showPlan, ready])

  return <div ref={containerRef} className="absolute inset-0 z-0 min-h-0 w-full" />
}
