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
import { StylusPressureIndicator } from './StylusPressureIndicator'

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
 * SVG overlay para desenho freehand com caneta (stylus).
 *
 * Phase 3 — Stylus & Pen:
 * - 3-A: StylusPressureIndicator integrado — círculos concêntricos seguem a
 *         caneta com feedback visual de pressão em tempo real.
 * - 3-B: Preview simplificado ao vivo (verde brand #3ecf8e, 200ms de lag) durante
 *         o traço; ao aceitar, animação `dd-polygon-fill-in` (300ms) antes de
 *         converter em polígono editável.
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
  // Preview simplificado ao vivo com 200ms de lag (Phase 3-B)
  const [liveSimplifiedPoints, setLiveSimplifiedPoints] = useState<[number, number][] | null>(null)
  // Animação de aceitação antes de commitar no store (Phase 3-B)
  const [isAccepting, setIsAccepting] = useState(false)
  const [epsilonIndex, setEpsilonIndex] = useState(DEFAULT_EPSILON_INDEX)
  const [isDrawing, setIsDrawing] = useState(false)

  const rawRef = useRef<[number, number][]>([])
  const isDrawingRef = useRef(false)
  const simplifiedRef = useRef<[number, number][] | null>(null)
  const acceptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  // ── Phase 3-B: preview simplificado ao vivo (atualiza a cada 200ms) ──
  useEffect(() => {
    if (!isDrawing) {
      setLiveSimplifiedPoints(null)
      return
    }
    const interval = setInterval(() => {
      const pts = rawRef.current
      if (pts.length < 5) return
      setLiveSimplifiedPoints(simplifyPath(pts, EPSILON_LEVELS[DEFAULT_EPSILON_INDEX]!))
    }, 200)
    return () => clearInterval(interval)
  }, [isDrawing])

  /** Sair do modo desenho: encerra sessão freehand e limpa traço. */
  useEffect(() => {
    if (visible) return
    if (acceptTimerRef.current) {
      clearTimeout(acceptTimerRef.current)
      acceptTimerRef.current = null
    }
    penSessionEngagedRef.current = false
    setPenSessionEngaged(false)
    setRawPoints([])
    setSimplifiedPoints(null)
    setLiveSimplifiedPoints(null)
    setIsAccepting(false)
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
    setLiveSimplifiedPoints(null)
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
   * Captura eventos de caneta em fase capture; toque no dedo passa direto
   * ao Leaflet sem interferência.
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
      setLiveSimplifiedPoints(null)
      setIsAccepting(false)
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

  // ── Phase 3-B: aceitar com animação de fill-in (300ms) antes de commitar ──
  const handleAccept = useCallback(() => {
    const pts = simplifiedPoints
    if (!pts || pts.length < 3 || isAccepting) return

    haptic.success()
    setIsAccepting(true)

    acceptTimerRef.current = setTimeout(() => {
      acceptTimerRef.current = null
      const ring = [...pts, pts[0]!]
      const feature = polyFeature([ring.map(([lat, lng]) => [lng, lat])])
      setPolygon(feature)
      setDraftPoints([])
      setPlannerInteractionMode('navigate')
      setSimplifiedPoints(null)
      setRawPoints([])
      rawRef.current = []
      penSessionEngagedRef.current = false
      setPenSessionEngaged(false)
      setIsAccepting(false)
    }, 320)
  }, [simplifiedPoints, isAccepting, setPolygon, setDraftPoints, setPlannerInteractionMode])

  const handleRedraw = useCallback(() => {
    if (acceptTimerRef.current) {
      clearTimeout(acceptTimerRef.current)
      acceptTimerRef.current = null
    }
    setSimplifiedPoints(null)
    setRawPoints([])
    setLiveSimplifiedPoints(null)
    setIsAccepting(false)
    rawRef.current = []
    haptic.light()
  }, [])

  if (!visible || !penSessionEngaged) {
    return null
  }

  const container = map.getContainer()
  const rect = container.getBoundingClientRect()

  // Converte LatLng → string "x,y" para atributo points do SVG
  const toSvg = (pt: [number, number]) => {
    const p = map.latLngToContainerPoint([pt[0], pt[1]])
    return `${p.x},${p.y}`
  }

  // Converte LatLng → {x, y} para elementos SVG individuais
  const toSvgXY = (pt: [number, number]) => {
    return map.latLngToContainerPoint([pt[0], pt[1]])
  }

  const rawPolylineStr =
    rawPoints.length > 1 ? rawPoints.map(toSvg).join(' ') : null

  const liveSimplifiedStr =
    liveSimplifiedPoints && liveSimplifiedPoints.length > 1
      ? liveSimplifiedPoints.map(toSvg).join(' ')
      : null

  const simplifiedPolygonStr =
    simplifiedPoints && simplifiedPoints.length > 1
      ? simplifiedPoints.map(toSvg).join(' ')
      : null

  // Ponta do traço atual — indicador de posição ativa
  const tipPoint =
    isDrawing && rawPoints.length > 0 ? toSvgXY(rawPoints[rawPoints.length - 1]!) : null

  return createPortal(
    <>
      {/* Phase 3-A: indicador de pressão da caneta */}
      <StylusPressureIndicator visible={visible} />

      <div
        className="pointer-events-none absolute inset-0 z-[450]"
        style={{ width: rect.width, height: rect.height, left: 0, top: 0 }}
      >
        <svg
          className="absolute inset-0 h-full w-full"
          style={{ pointerEvents: 'none' }}
          aria-hidden
        >
          {/* Traço bruto — cinza suave enquanto o usuário desenha */}
          {rawPolylineStr && !simplifiedPoints && (
            <polyline
              points={rawPolylineStr}
              fill="none"
              stroke="rgba(200,200,220,0.45)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Phase 3-B: preview simplificado ao vivo (verde brand, 200ms de lag) */}
          {isDrawing && liveSimplifiedStr && (
            <polyline
              key={liveSimplifiedStr.length}
              points={liveSimplifiedStr}
              fill="none"
              stroke="#3ecf8e"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="dd-freehand-live-path"
              style={{ filter: 'drop-shadow(0 0 4px rgba(62,207,142,0.5))' }}
            />
          )}

          {/* Indicador de ponta do traço ativo */}
          {tipPoint && (
            <g>
              <circle
                cx={tipPoint.x}
                cy={tipPoint.y}
                r={10}
                fill="rgba(62,207,142,0.15)"
                className="dd-freehand-tip-ring"
              />
              <circle
                cx={tipPoint.x}
                cy={tipPoint.y}
                r={3.5}
                fill="rgba(62,207,142,0.75)"
              />
            </g>
          )}

          {/* Phase 3-B: preview de polígono na revisão (e animação ao aceitar) */}
          {simplifiedPolygonStr && (
            <polygon
              points={simplifiedPolygonStr}
              fill="rgba(62,207,142,0.1)"
              stroke="#3ecf8e"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={isAccepting ? 'dd-polygon-accepting' : undefined}
              style={{ filter: 'drop-shadow(0 0 4px rgba(62,207,142,0.3))' }}
            />
          )}
        </svg>

        {/* Chrome de revisão: ajuste de vértices + aceitar / redesenhar */}
        {simplifiedPoints && (
          <div
            data-freehand-chrome
            className="pointer-events-auto absolute bottom-24 left-1/2 -translate-x-1/2"
            style={{ zIndex: 460 }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div
              className={cn(
                'flex flex-col items-center gap-2.5 rounded-2xl border border-white/10 bg-[rgba(20,20,22,0.97)] p-3 shadow-2xl',
                maybeBackdropBlur(deviceTier, 'md'),
              )}
            >
              {/* Ajuste de densidade de vértices */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleEpsilonChange(1)}
                  disabled={isAccepting}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm
                             transition hover:bg-white/10 disabled:pointer-events-none disabled:opacity-40"
                  title="Menos vértices"
                >
                  − Menos
                </button>

                <span className="min-w-[5.5rem] text-center">
                  <span className="block text-sm font-semibold tabular-nums text-[#fafafa]">
                    {simplifiedPoints.length}
                  </span>
                  <span className="block text-[10px] leading-tight text-[#777]">vértices</span>
                </span>

                <button
                  type="button"
                  onClick={() => handleEpsilonChange(-1)}
                  disabled={isAccepting}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm
                             transition hover:bg-white/10 disabled:pointer-events-none disabled:opacity-40"
                  title="Mais vértices"
                >
                  + Mais
                </button>
              </div>

              {/* Ações principais */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleRedraw}
                  disabled={isAccepting}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm
                             text-[#fafafa] transition hover:bg-white/10
                             disabled:pointer-events-none disabled:opacity-40"
                >
                  ↺ Redesenhar
                </button>

                <button
                  type="button"
                  onClick={handleAccept}
                  disabled={isAccepting}
                  className={cn(
                    'relative overflow-hidden rounded-xl border px-4 py-2 text-sm font-medium transition',
                    isAccepting
                      ? 'border-[#3ecf8e]/60 bg-[#3ecf8e]/20 text-[#3ecf8e]'
                      : 'border-[#3ecf8e]/40 bg-[#3ecf8e]/10 text-[#3ecf8e] hover:bg-[#3ecf8e]/20',
                  )}
                >
                  {isAccepting ? (
                    <span className="flex items-center gap-1.5">
                      <span className="dd-accept-spinner inline-block h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent" />
                      Aplicando…
                    </span>
                  ) : (
                    '✓ Aceitar'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>,
    container,
  )
}
