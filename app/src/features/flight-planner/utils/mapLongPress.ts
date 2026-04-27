/** Alinhado a `docs/plano-ux-interacao-mapa.md` (mapa e handles). */
export const MAP_LONG_PRESS_MS = 500
export const MAP_LONG_PRESS_MOVE_SLOP_PX = 10
/** Slop maior em marcadores touch: evita cancelar o hold com micro-movimento e ajuda contra ruído do touch. */
export const MAP_LONG_PRESS_MARKER_TOUCH_SLOP_PX = 28

export function getEventClientPoint(
  ev: Event | undefined | null,
): { clientX: number; clientY: number } | null {
  if (!ev) return null
  if ("clientX" in ev && typeof (ev as PointerEvent).clientX === "number") {
    const p = ev as PointerEvent
    return { clientX: p.clientX, clientY: p.clientY }
  }
  if (typeof TouchEvent !== "undefined" && ev instanceof TouchEvent) {
    const t = ev.touches[0] ?? ev.changedTouches[0]
    if (t) return { clientX: t.clientX, clientY: t.clientY }
  }
  return null
}

/**
 * Dispara `onFire` após `durationMs` se o ponteiro não passar de `slopPx`
 * em relação a `origin` e for solto antes (cancela).
 * Remove listeners ao cancelar ou após o disparo.
 */
export function subscribeHoldStillLongPress(
  origin: { clientX: number; clientY: number },
  onFire: () => void,
  opts?: { durationMs?: number; slopPx?: number },
): () => void {
  const durationMs = opts?.durationMs ?? MAP_LONG_PRESS_MS
  const slopPx = opts?.slopPx ?? MAP_LONG_PRESS_MOVE_SLOP_PX
  const slop2 = slopPx * slopPx
  let done = false

  const teardownListeners = () => {
    window.removeEventListener("pointermove", onMove)
    window.removeEventListener("pointerup", onEnd)
    window.removeEventListener("pointercancel", onEnd)
    window.removeEventListener("mousemove", onMove)
    window.removeEventListener("mouseup", onEnd)
    window.removeEventListener("touchmove", onMove, { capture: true } as AddEventListenerOptions)
    window.removeEventListener("touchend", onEnd, { capture: true } as AddEventListenerOptions)
    window.removeEventListener("touchcancel", onEnd, { capture: true } as AddEventListenerOptions)
  }

  const cancel = () => {
    if (done) return
    done = true
    window.clearTimeout(tid)
    teardownListeners()
  }

  const onMove = (e: Event) => {
    // Com touch, o browser pode emitir `mousemove`/`pointermove` sintéticos com `buttons === 0`
    // ou coordenadas espúrias; isso cancelava o hold antes dos 500 ms.
    if (e.type === "mousemove") {
      const me = e as MouseEvent
      if (me.buttons === 0) return
    }
    if (e.type === "pointermove") {
      const pe = e as PointerEvent
      if (pe.pointerType === "mouse" && pe.buttons === 0) return
    }
    const p = getEventClientPoint(e)
    if (!p) return
    const dx = p.clientX - origin.clientX
    const dy = p.clientY - origin.clientY
    if (dx * dx + dy * dy > slop2) cancel()
  }

  const onEnd = () => cancel()

  const tid = window.setTimeout(() => {
    if (done) return
    done = true
    teardownListeners()
    onFire()
  }, durationMs)

  window.addEventListener("pointermove", onMove, { passive: true })
  window.addEventListener("pointerup", onEnd)
  window.addEventListener("pointercancel", onEnd)
  window.addEventListener("mousemove", onMove, { passive: true })
  window.addEventListener("mouseup", onEnd)
  window.addEventListener("touchmove", onMove, { passive: true, capture: true })
  window.addEventListener("touchend", onEnd, { capture: true })
  window.addEventListener("touchcancel", onEnd, { capture: true })

  return cancel
}

/**
 * Long press no elemento do marcador (capture), antes dos handlers do Leaflet,
 * com debounce entre `pointerdown` + `touchstart` no mesmo toque.
 */
export function attachHoldStillLongPressToElement(
  el: HTMLElement,
  callbacks: {
    onFire: () => void
    shouldIgnore?: () => boolean
    slopPx?: number
  },
): { detach: () => void; cancelActiveHold: () => void } {
  let holdDispose: (() => void) | null = null
  let lastArmMs = 0

  const cancelActiveHold = () => {
    holdDispose?.()
    holdDispose = null
  }

  const onDown = (ev: Event) => {
    if (callbacks.shouldIgnore?.()) return
    if (ev instanceof PointerEvent && ev.pointerType === "mouse" && ev.button !== 0) {
      return
    }
    const now = performance.now()
    if (now - lastArmMs < 240) return
    lastArmMs = now
    cancelActiveHold()
    const pt = getEventClientPoint(ev)
    if (!pt) return
    holdDispose = subscribeHoldStillLongPress(pt, callbacks.onFire, {
      slopPx: callbacks.slopPx ?? MAP_LONG_PRESS_MOVE_SLOP_PX,
    })
  }

  el.addEventListener("pointerdown", onDown, { capture: true })
  el.addEventListener("touchstart", onDown, {
    capture: true,
    passive: true,
  } as AddEventListenerOptions)

  const detach = () => {
    el.removeEventListener("pointerdown", onDown, { capture: true })
    el.removeEventListener("touchstart", onDown, { capture: true })
    cancelActiveHold()
  }

  return { detach, cancelActiveHold }
}

/** `pointerup` / `touchend`: soltar ainda sobre o elemento (ex.: arrastar o dedo até «Deletar» após o long-press). */
export function isReleaseOverElement(el: HTMLElement | null, e: Event): boolean {
  if (!el) return false
  let x: number
  let y: number
  if (e instanceof PointerEvent) {
    x = e.clientX
    y = e.clientY
  } else if (typeof TouchEvent !== "undefined" && e instanceof TouchEvent) {
    const t = e.changedTouches[0]
    if (!t) return false
    x = t.clientX
    y = t.clientY
  } else {
    return false
  }
  const hit = document.elementFromPoint(x, y)
  return Boolean(hit && el.contains(hit))
}
