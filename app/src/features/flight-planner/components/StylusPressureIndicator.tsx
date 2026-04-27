import { useCallback, useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'

interface StylusPressureIndicatorProps {
  /** Render e rastreia eventos apenas quando verdadeiro */
  visible: boolean
}

/**
 * Canvas overlay sobreposto ao mapa que exibe um indicador visual de pressão
 * da caneta (stylus) em tempo real. Dois círculos concêntricos acompanham
 * a posição do pen:
 *   - Círculo interno (4px): posição exata, sempre visível
 *   - Círculo externo (8–18px): escala e opacidade proporcionais à pressão
 *
 * O canvas é gerenciado imperativament via useEffect e se insere diretamente
 * no container do Leaflet como elemento absoluto sem pointer-events.
 */
export function StylusPressureIndicator({ visible }: StylusPressureIndicatorProps) {
  const map = useMap()

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const penPosRef = useRef<{ x: number; y: number; pressure: number } | null>(null)
  const alphaRef = useRef(0)
  const rafIdRef = useRef<number | null>(null)
  const scheduleFrameRef = useRef<(() => void) | null>(null)

  const drawFrame = useCallback(() => {
    rafIdRef.current = null
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const pos = penPosRef.current

    // Fade in / fade out suavemente
    if (pos) {
      alphaRef.current = Math.min(1, alphaRef.current + 0.18)
    } else {
      alphaRef.current = Math.max(0, alphaRef.current - 0.12)
    }

    if (alphaRef.current > 0.01 && pos) {
      const { x, y, pressure } = pos
      const alpha = alphaRef.current
      // Normaliza pressão — pen sem suporte retorna 0; tratar como pressão leve
      const p = Math.max(0.08, pressure)

      // ── Glow difuso ao redor do ponto ──────────────────────────────
      const glowRadius = 14 + p * 8
      const glowGrad = ctx.createRadialGradient(x, y, 0, x, y, glowRadius)
      glowGrad.addColorStop(0, `rgba(62,207,142,${0.22 * alpha * p})`)
      glowGrad.addColorStop(1, 'rgba(62,207,142,0)')
      ctx.beginPath()
      ctx.arc(x, y, glowRadius, 0, Math.PI * 2)
      ctx.fillStyle = glowGrad
      ctx.fill()

      // ── Anel externo: tamanho e opacidade proporcionais à pressão ──
      const outerRadius = 8 + p * 10          // 8–18 px
      const outerOpacity = (0.22 + p * 0.58) * alpha
      ctx.beginPath()
      ctx.arc(x, y, outerRadius, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(62,207,142,${outerOpacity})`
      ctx.lineWidth = 1.5
      ctx.stroke()

      // ── Ponto interno: posição precisa ─────────────────────────────
      ctx.beginPath()
      ctx.arc(x, y, 4, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(62,207,142,${0.92 * alpha})`
      ctx.fill()

      // Borda branca no ponto interno para contraste em qualquer mapa
      ctx.beginPath()
      ctx.arc(x, y, 4, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(255,255,255,${0.55 * alpha})`
      ctx.lineWidth = 0.75
      ctx.stroke()

      // Continua animando para fade out gradual quando pen levanta
      rafIdRef.current = requestAnimationFrame(drawFrame)
    } else if (alphaRef.current > 0.01) {
      // fade out em andamento sem posição
      rafIdRef.current = requestAnimationFrame(drawFrame)
    }
  }, [])

  const scheduleFrame = useCallback(() => {
    if (!rafIdRef.current) {
      rafIdRef.current = requestAnimationFrame(drawFrame)
    }
  }, [drawFrame])

  // Mantém ref estável para o handler de pointer
  scheduleFrameRef.current = scheduleFrame

  // ── Canvas: criação, dimensionamento e remoção ───────────────────────
  useEffect(() => {
    if (!visible) return

    const container = map.getContainer()
    const canvas = document.createElement('canvas')
    canvas.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none'
    canvas.style.zIndex = '470'
    canvas.setAttribute('aria-hidden', 'true')
    canvasRef.current = canvas
    container.appendChild(canvas)

    const syncSize = () => {
      const rect = container.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      const ctx = canvas.getContext('2d')
      if (ctx && dpr !== 1) ctx.scale(dpr, dpr)
      scheduleFrameRef.current?.()
    }

    syncSize()
    const ro = new ResizeObserver(syncSize)
    ro.observe(container)

    return () => {
      ro.disconnect()
      canvas.remove()
      canvasRef.current = null
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
    }
  }, [visible, map])

  // ── Rastreamento de posição e pressão da caneta ──────────────────────
  useEffect(() => {
    if (!visible) return

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'pen') return
      const canvas = canvasRef.current
      if (!canvas) return
      // Converte clientX/Y para coordenadas relativas ao canvas
      const rect = canvas.getBoundingClientRect()
      penPosRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        pressure: e.pressure,
      }
      scheduleFrameRef.current?.()
    }

    const onLeave = (e: PointerEvent) => {
      if (e.pointerType !== 'pen') return
      penPosRef.current = null
      scheduleFrameRef.current?.()
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    // pointerleave no window cobre quando pen sai da tela por completo
    window.addEventListener('pointerleave', onLeave, { passive: true })
    // pointerup/cancel: pen levantou; iniciar fade out
    const onUp = (e: PointerEvent) => {
      if (e.pointerType !== 'pen') return
      penPosRef.current = null
      scheduleFrameRef.current?.()
    }
    window.addEventListener('pointerup', onUp, { passive: true })
    window.addEventListener('pointercancel', onUp, { passive: true })

    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      penPosRef.current = null
    }
  }, [visible])

  return null
}
