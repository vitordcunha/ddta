export type GestureContext =
  | "map-idle"
  | "draw-polygon"
  | "edit-vertex"
  | "edit-polygon-move"
  | "pen-freehand"
  | "panel-scroll"

export type GestureHandlerContext = GestureContext[] | "all"

export type GestureHandler = {
  id: string
  priority: number
  context: GestureHandlerContext
  fingers: number | "any"
  onActivate: () => void
  onDeactivate: () => void
}

function contextMatches(
  handler: GestureHandler,
  ctx: GestureContext,
): boolean {
  if (handler.context === "all") return true
  return handler.context.includes(ctx)
}

function fingersMatch(handler: GestureHandler, nFingers: number): boolean {
  if (handler.fingers === "any") return true
  return handler.fingers === nFingers
}

export class GestureManager {
  private context: GestureContext = "map-idle"

  private handlers = new Map<string, GestureHandler>()

  private activeHandlerId: string | null = null

  setContext(ctx: GestureContext): void {
    this.context = ctx
  }

  getContext(): GestureContext {
    return this.context
  }

  register(handler: GestureHandler): () => void {
    this.handlers.set(handler.id, handler)
    return () => {
      if (this.activeHandlerId === handler.id) {
        handler.onDeactivate()
        this.activeHandlerId = null
      }
      this.handlers.delete(handler.id)
    }
  }

  /** Maior prioridade entre handlers ativos para o contexto e número de dedos. */
  resolve(nFingers: number): GestureHandler | null {
    let best: GestureHandler | null = null
    for (const h of this.handlers.values()) {
      if (!contextMatches(h, this.context)) continue
      if (!fingersMatch(h, nFingers)) continue
      if (!best || h.priority > best.priority) best = h
    }
    return best
  }

  getActiveHandlerId(): string | null {
    return this.activeHandlerId
  }

  /** Marca handler como ativo (uso opcional junto a resolve). */
  setActiveHandler(id: string | null): void {
    this.activeHandlerId = id
  }
}
