import type * as L from "leaflet";

export function prefersReducedMapMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Pulso no contorno do polígono ao soltar um vértice após edição.
 * Flash rápido: stroke fica brilhante por 90ms, depois volta suavemente.
 */
export function runPolygonOutlinePulse(
  el: SVGPathElement,
  opts: { reduced: boolean },
): () => void {
  if (opts.reduced) return () => undefined;

  el.style.transition = "stroke-opacity 80ms ease-out, filter 80ms ease-out";
  el.style.strokeOpacity = "1";
  el.style.filter = "drop-shadow(0 0 5px rgba(62, 207, 142, 0.65))";

  const t1 = window.setTimeout(() => {
    el.style.transition = "stroke-opacity 320ms ease-out, filter 320ms ease-out";
    el.style.strokeOpacity = "";
    el.style.filter = "none";
  }, 90);

  const t2 = window.setTimeout(() => {
    el.style.removeProperty("transition");
    el.style.removeProperty("stroke-opacity");
    el.style.removeProperty("filter");
  }, 440);

  return () => {
    clearTimeout(t1);
    clearTimeout(t2);
  };
}

/**
 * Transição suave quando a geometria do polígono muda sem remount
 * (ex.: footprint de câmera ao mudar altitude/ângulo).
 * Breve dip de opacidade + recover para dar sensação de "update" fluido.
 */
export function runPolygonGeometryTransition(
  el: SVGPathElement,
  opts: { reduced: boolean; fillOpacity: number; strokeOpacity: number },
): () => void {
  const { reduced, fillOpacity, strokeOpacity } = opts;
  if (reduced) return () => undefined;

  const dipMs = 90;
  const recoverMs = 240;

  el.style.transition = `fill-opacity ${dipMs}ms ease-out, stroke-opacity ${dipMs}ms ease-out`;
  el.setAttribute("fill-opacity", String(fillOpacity * 0.35));
  el.setAttribute("stroke-opacity", String(strokeOpacity * 0.35));

  const t1 = window.setTimeout(() => {
    el.style.transition = `fill-opacity ${recoverMs}ms ease-out, stroke-opacity ${recoverMs}ms ease-out`;
    el.setAttribute("fill-opacity", String(fillOpacity));
    el.setAttribute("stroke-opacity", String(strokeOpacity));
  }, dipMs);

  const t2 = window.setTimeout(() => {
    el.style.removeProperty("transition");
  }, dipMs + recoverMs + 60);

  return () => {
    clearTimeout(t1);
    clearTimeout(t2);
  };
}

/** Fade-out para strips/polylines saindo do mapa (animação de saída). */
export function runPolylineFadeOut(
  el: SVGPathElement,
  opts: { durationMs: number; reduced: boolean },
): () => void {
  const { durationMs, reduced } = opts;
  if (reduced) {
    el.style.opacity = "0";
    return () => undefined;
  }
  el.style.transition = `opacity ${durationMs}ms ease-out`;
  el.style.opacity = "0";
  const t = window.setTimeout(() => {
    el.style.removeProperty("transition");
  }, durationMs + 60);
  return () => clearTimeout(t);
}

export function getLeafletPathSvgEl(layer: L.Path): SVGElement | null {
  const anyLayer = layer as unknown as {
    getElement?: () => SVGElement | null;
    _path?: SVGElement | null;
  };
  if (typeof anyLayer.getElement === "function") {
    return anyLayer.getElement() ?? anyLayer._path ?? null;
  }
  return anyLayer._path ?? null;
}

/** Rota / faixas: efeito de “traço se desenha” no path SVG. */
export function runPolylineDrawReveal(
  el: SVGPathElement,
  opts: { durationMs: number; reduced: boolean; finalLineOpacity: number },
) {
  const { durationMs, reduced, finalLineOpacity } = opts;
  if (!reduced) {
    const len = el.getTotalLength();
    if (Number.isFinite(len) && len > 0) {
      el.style.strokeDasharray = String(len);
      el.style.strokeDashoffset = String(len);
    }
  }
  el.style.opacity = reduced ? String(finalLineOpacity) : "0";
  el.style.transition = "none";
  requestAnimationFrame(() => {
    if (reduced) return;
    el.style.transition = `stroke-dashoffset ${durationMs}ms cubic-bezier(0.2, 0.85, 0.2, 1), opacity 240ms ease-out`;
    el.style.strokeDashoffset = "0";
    el.style.opacity = String(finalLineOpacity);
  });
  const clearAfter = window.setTimeout(() => {
    el.style.removeProperty("transition");
    if (!reduced) {
      el.style.removeProperty("stroke-dasharray");
      el.style.removeProperty("stroke-dashoffset");
    }
  }, durationMs + 80);
  return () => {
    clearTimeout(clearAfter);
  };
}

/** Polígono: preenchimento e contorno com fade (uma vez, ou quando force=true). */
export function runPolygonFadeIn(
  el: SVGPathElement,
  opts: {
    reduced: boolean;
    fillOpacity: number;
    strokeOpacity: number;
    durationMs: number;
  },
) {
  const { reduced, fillOpacity, strokeOpacity, durationMs } = opts;
  if (reduced) {
    el.setAttribute("fill-opacity", String(fillOpacity));
    el.setAttribute("stroke-opacity", String(strokeOpacity));
    return () => undefined;
  }
  el.setAttribute("fill-opacity", "0");
  el.setAttribute("stroke-opacity", "0");
  el.style.transition = "none";
  requestAnimationFrame(() => {
    el.style.transition = `fill-opacity ${durationMs}ms ease-out, stroke-opacity ${Math.min(320, durationMs)}ms ease-out`;
    el.setAttribute("fill-opacity", String(fillOpacity));
    el.setAttribute("stroke-opacity", String(strokeOpacity));
  });
  const t = window.setTimeout(() => {
    el.style.removeProperty("transition");
  }, durationMs + 80);
  return () => {
    clearTimeout(t);
  };
}
