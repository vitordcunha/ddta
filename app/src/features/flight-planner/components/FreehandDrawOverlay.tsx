import { useCallback, useEffect, useRef, useState } from 'react'
import { lineString, polygon as polyFeature } from '@turf/helpers'
import simplify from '@turf/simplify'
import { useMap } from 'react-leaflet'
import { createPortal } from 'react-dom'
import { useFlightStore } from '@/features/flight-planner/stores/useFlightStore'
import { useMapEngine } from '@/features/map-engine/useMapEngine'
import { maybeBackdropBlur, useDeviceTier } from '@/lib/deviceUtils'
import { cn } from '@/lib/utils'
import { haptic } from '@/utils/haptics'

const FREEHAND_CHROME = '[data-freehand-chrome]'

function isInsideFreehandChrome(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(FREEHAND_CHROME))
}

function simplifyPath(rawPoints: [number, number][], tolerance: number): [number, number][] {
  if (rawPoints.length < 3) return rawPoints
  const line = lineString(rawPoints.map(([lat, lng]) => [lng, lat]))
  const simplified = simplify(line, { tolerance, highQuality: true })
  return simplified.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number])
}

const EPSILON_LEVELS = [0.00002, 0.00005, 0.0001, 0.0002, 0.0005]
const DEFAULT_EPSILON_INDEX = 1

export interface FreehandDrawOverlayProps {
  visible: boolean
}

/**
 * Módulo 4: SVG overlay para desenho freehand com caneta (stylus).
 * Em modo desenho, detecta caneta (hover ou toque) e engaja freehand; traço
 * capturado só para pointerType pen sem bloquear toque no mapa.
 */
export function FreehandDrawOverlay({ visible }: FreehandDrawOverlayProps) {
  const map = useMap()
  const deviceTier = useDeviceTier()
  const { disableMapPan, enableMapPan } = useMapEngine()
  const setPolygon = useFlightStore((s) => s.setPolygon)
  const setPlannerInteractionMode = useFlightStore((s) => s.setPlannerInteractionMode)
  const setDraftPoints = useFlightStore((s) => s.setDraftPoints)

  const [penSessionEngaged, setPenSessionEngaged] = useState(false)
  const penSessionEngagedRef = useRef(false)
  const [rawPoints, setRawPoints] = useState<[number, number][]>([])
  const [simplifiedPoints, setSimplifiedPoints] = useState<[number, number][] | null>(null)
  const [epsilonIndex, setEpsilonIndex] = useState(DEFAULT_EPSILON_INDEX)
  const [isDrawing, setIsDrawing] = useState(false)

  const rawRef = useRef<[number, number][]>([])
  const isDrawingRef = useRef(false)
  const simplifiedRef = useRef<[number, number][] | null>(null)

  const engagePenSession = useCallback(() => {
    if (penSessionEngagedRef.current) return
    penSessionEngagedRef.current = true
    setPenSessionEngaged(true)
  }, [])

  useEffect(() => {
    simplifiedRef.current = simplifiedPoints
  }, [simplifiedPoints])

  useEffect(() => {
    isDrawingRef.current = isDrawing
  }, [isDrawing])

  /** Sair do modo desenho: encerra sessão freehand e limpa traço. */
  useEffect(() => {
    if (visible) return
    penSessionEngagedRef.current = false
    setPenSessionEngaged(false)
    setRawPoints([])
    setSimplifiedPoints(null)
    setIsDrawing(false)
    isDrawingRef.current = false
    rawRef.current = []
    enableMapPan()
  }, [visible, enableMapPan])

  const pixelToLatLng = useCallback(
    (x: number, y: number): [number, number] => {
      const rect = map.getContainer().getBoundingClientRect()
      const latlng = map.containerPointToLatLng([x - rect.left, y - rect.top])
      return [latlng.lat, latlng.lng]
    },
    [map],
  )

  const finishStrokeFromRef = useCallback(() => {
    setIsDrawing(false)
    isDrawingRef.current = false
    enableMapPan()
    const pts = rawRef.current
    if (pts.length < 3) {
      rawRef.current = []
      setRawPoints([])
      return
    }
    const simplified = simplifyPath(pts, EPSILON_LEVELS[DEFAULT_EPSILON_INDEX]!)
    setSimplifiedPoints(simplified)
    setEpsilonIndex(DEFAULT_EPSILON_INDEX)
  }, [enableMapPan])

  /**
   * Modo desenho: hover/touch da caneta engaja sessão; captura em fase capture
   * só para caneta, para o dedo continuar no Leaflet.
   */
  useEffect(() => {
    if (!visible) return

    const mapEl = map.getContainer()

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== 'pen') return
      engagePenSession()
    }

    const onPointerDownEngage = (e: PointerEvent) => {
      if (e.pointerType !== 'pen') return
      engagePenSession()
    }

    const onPointerDownCapture = (e: PointerEvent) => {
      if (e.pointerType !== 'pen') return
      if (isInsideFreehandChrome(e.target)) return
      if (!(e.target instanceof Node) || !mapEl.contains(e.target)) return
      if (simplifiedRef.current) {
        e.preventDefault()
        e.stopPropagation()
        return
      }
      if (isDrawingRef.current) return

      engagePenSession()
      e.preventDefault()
      e.stopPropagation()
      disableMapPan()
      haptic.medium()
      try {
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      rawRef.current = [pixelToLatLng(e.clientX, e.clientY)]
      setRawPoints([...rawRef.current])
      setSimplifiedPoints(null)
      setIsDrawing(true)
      isDrawingRef.current = true
    }

    const onPointerMoveCapture = (e: PointerEvent) => {
      if (!isDrawingRef.current || e.pointerType !== 'pen') return
      if (isInsideFreehandChrome(e.target)) return
      e.preventDefault()
      rawRef.current = [...rawRef.current, pixelToLatLng(e.clientX, e.clientY)]
      setRawPoints([...rawRef.current])
    }

    const onPointerUpCapture = (e: PointerEvent) => {
      if (!isDrawingRef.current || e.pointerType !== 'pen') return
      e.preventDefault()
      finishStrokeFromRef()
    }

    const onPointerCancelCapture = (e: PointerEvent) => {
      if (!isDrawingRef.current || e.pointerType !== 'pen') return
      e.preventDefault()
      finishStrokeFromRef()
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerdown', onPointerDownEngage, true)
    window.addEventListener('pointerdown', onPointerDownCapture, true)
    window.addEventListener('pointermove', onPointerMoveCapture, true)
    window.addEventListener('pointerup', onPointerUpCapture, true)
    window.addEventListener('pointercancel', onPointerCancelCapture, true)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerdown', onPointerDownEngage, true)
      window.removeEventListener('pointerdown', onPointerDownCapture, true)
      window.removeEventListener('pointermove', onPointerMoveCapture, true)
      window.removeEventListener('pointerup', onPointerUpCapture, true)
      window.removeEventListener('pointercancel', onPointerCancelCapture, true)
    }
  }, [visible, map, engagePenSession, disableMapPan, pixelToLatLng, finishStrokeFromRef])

  const handleEpsilonChange = useCallback(
    (delta: number) => {
      const next = Math.max(0, Math.min(EPSILON_LEVELS.length - 1, epsilonIndex + delta))
      if (next === epsilonIndex) return
      setEpsilonIndex(next)
      const simplified = simplifyPath(rawRef.current, EPSILON_LEVELS[next]!)
      setSimplifiedPoints(simplified)
    },
    [epsilonIndex],
  )

  const handleAccept = useCallback(() => {
    const pts = simplifiedPoints
    if (!pts || pts.length < 3) return
    const ring = [...pts, pts[0]!]
    const feature = polyFeature([ring.map(([lat, lng]) => [lng, lat])])
    setPolygon(feature)
    setDraftPoints([])
    setPlannerInteractionMode('navigate')
    haptic.success()
    setSimplifiedPoints(null)
    setRawPoints([])
    rawRef.current = []
    penSessionEngagedRef.current = false
    setPenSessionEngaged(false)
  }, [simplifiedPoints, setPolygon, setDraftPoints, setPlannerInteractionMode])

  const handleRedraw = useCallback(() => {
    setSimplifiedPoints(null)
    setRawPoints([])
    rawRef.current = []
    haptic.light()
  }, [])

  if (!visible || !penSessionEngaged) {
    return null
  }

  const container = map.getContainer()
  const rect = container.getBoundingClientRect()

  const toSvg = (pt: [number, number]) => {
    const p = map.latLngToContainerPoint([pt[0], pt[1]])
    return `${p.x},${p.y}`
  }

  const rawPolyline =
    rawPoints.length > 1 ? rawPoints.map(toSvg).join(' ') : null
  const simplifiedPolyline =
    simplifiedPoints && simplifiedPoints.length > 1
      ? simplifiedPoints.map(toSvg).join(' ')
      : null

  return createPortal(
    <div
      className="pointer-events-none absolute inset-0 z-[450]"
      style={{ width: rect.width, height: rect.height, left: 0, top: 0 }}
    >
      <svg
        className="absolute inset-0 h-full w-full"
        style={{ pointerEvents: 'none' }}
        aria-hidden
      >
        {rawPolyline && !simplifiedPoints && (
          <polyline
            points={rawPolyline}
            fill="none"
            stroke="rgba(200,200,220,0.55)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {simplifiedPolyline && (
          <polyline
            points={simplifiedPolyline}
            fill="rgba(96,165,250,0.15)"
            stroke="#60A5FA"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="6 3"
          />
        )}
      </svg>

      {simplifiedPoints ? (
        <div
          data-freehand-chrome
          className="pointer-events-auto absolute bottom-24 left-1/2 -translate-x-1/2"
          style={{ zIndex: 460 }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div
            className={cn(
              'flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-[rgba(26,26,26,0.97)] p-3 shadow-xl',
              maybeBackdropBlur(deviceTier, 'md'),
            )}
          >
            <div className="flex items-center gap-2 text-xs text-[#b4b4b4]">
              <button
                type="button"
                onClick={() => handleEpsilonChange(1)}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm transition hover:bg-white/10"
                title="Menos vértices"
              >
                − Menos
              </button>
              <span className="min-w-[5rem] text-center font-medium text-[#fafafa]">
                {simplifiedPoints.length} vértices
              </span>
              <button
                type="button"
                onClick={() => handleEpsilonChange(-1)}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm transition hover:bg-white/10"
                title="Mais vértices"
              >
                + Mais
              </button>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleRedraw}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-[#fafafa] transition hover:bg-white/10"
              >
                ↺ Redesenhar
              </button>
              <button
                type="button"
                onClick={handleAccept}
                className="rounded-xl border border-[#3ecf8e]/40 bg-[#3ecf8e]/10 px-4 py-2 text-sm font-medium text-[#3ecf8e] transition hover:bg-[#3ecf8e]/20"
              >
                ✓ Aceitar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>,
    container,
  )
}
