import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const IDLE_HIDE_MS = 3000
const TOUCH_SUPPRESS_MS = 3000

/**
 * Indicador visual (sombra) sob a ponta da caneta em hover, em qualquer tela
 * do workspace. Esconde após inatividade da pen ou após toque; suprime
 * reexibição por alguns segundos após toque com o dedo.
 */
export function PenStylusShadow() {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suppressUntilRef = useRef(0)

  useEffect(() => {
    const clearIdleTimer = () => {
      if (idleTimerRef.current !== null) {
        clearTimeout(idleTimerRef.current)
        idleTimerRef.current = null
      }
    }

    const scheduleIdleHide = () => {
      clearIdleTimer()
      idleTimerRef.current = setTimeout(() => {
        idleTimerRef.current = null
        setPos(null)
      }, IDLE_HIDE_MS)
    }

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== 'pen') return

      if (e.buttons === 0) {
        if (Date.now() < suppressUntilRef.current) return
        setPos({ x: e.clientX, y: e.clientY })
        scheduleIdleHide()
      } else {
        clearIdleTimer()
        setPos(null)
      }
    }

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        clearIdleTimer()
        setPos(null)
        suppressUntilRef.current = Date.now() + TOUCH_SUPPRESS_MS
        return
      }
      if (e.pointerType === 'pen') {
        clearIdleTimer()
        setPos(null)
      }
    }

    const onPointerCancel = (e: PointerEvent) => {
      if (e.pointerType !== 'pen') return
      clearIdleTimer()
      setPos(null)
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('pointercancel', onPointerCancel, true)

    return () => {
      clearIdleTimer()
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('pointercancel', onPointerCancel, true)
    }
  }, [])

  if (!pos) return null

  return createPortal(
    <div
      className="pointer-events-none fixed rounded-full border border-sky-400/35 bg-sky-400/12 shadow-[0_0_20px_rgba(56,189,248,0.25)]"
      style={{
        width: 28,
        height: 28,
        left: pos.x - 14,
        top: pos.y - 14,
        zIndex: 10050,
      }}
      aria-hidden
    />,
    document.body,
  )
}
