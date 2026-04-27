import { useLayoutEffect, useRef, useMemo } from "react";
import type { Polygon as LeafletPolygon, Polyline as LeafletPolyline } from "leaflet";
import {
  Polygon,
  Polyline,
  type PolygonProps,
  type PolylineProps,
} from "react-leaflet";
import {
  getLeafletPathSvgEl,
  prefersReducedMapMotion,
  runPolygonFadeIn,
  runPolygonGeometryTransition,
  runPolygonOutlinePulse,
  runPolylineDrawReveal,
  runPolylineFadeOut,
} from "@/features/flight-planner/map/planMapLeafletPathEffects";
import { motion } from "@/lib/motionTokens";

function hashPolylinePositions(
  positions: PolylineProps["positions"] | undefined,
): string {
  if (!Array.isArray(positions) || positions.length < 2) return "";
  return positions
    .map((p) => {
      if (Array.isArray(p) && p.length >= 2) {
        return `${(p[0] as number).toFixed(5)},${(p[1] as number).toFixed(5)}`;
      }
      if (p && typeof p === "object" && "lat" in p) {
        const o = p as { lat: number; lng: number };
        return `${o.lat.toFixed(5)},${o.lng.toFixed(5)}`;
      }
      return "";
    })
    .join("|");
}

const POLYGON_FADE_MS = motion.duration.enter;
const ROUTE_DRAW_MS = motion.duration.route;
const STRIP_DRAW_MS = motion.duration.strip;
/** Duração máxima total do stagger de strips (ms). Proporcionalmente distribuída entre 0..N-1. */
const STRIP_STAGGER_TOTAL_MS = motion.duration.stripStaggerTotal;
/** Mínimo de delay para o stagger não parecer instantâneo em strips poucas. */
const STRIP_STAGGER_MIN_STEP_MS = motion.duration.stripStaggerMin;

/** Atraso proporcional para um strip de índice `i` de um total de `total`. */
function stripStaggerDelay(i: number, total: number, reduced: boolean): number {
  if (reduced) return 0;
  if (total <= 1) return 0;
  const step = Math.max(STRIP_STAGGER_MIN_STEP_MS, STRIP_STAGGER_TOTAL_MS / (total - 1));
  return Math.round(step * i);
}

// ─────────────────────────────────────────────────────────────────
// MappingPolygonAnimated
// ─────────────────────────────────────────────────────────────────

type MappingPolygonProps = {
  /** Desativa animação de entrada (ex.: prévia de calibração). */
  enableEnter?: boolean;
  /**
   * Incrementar para disparar pulso no contorno (ex.: após soltar vértice).
   * Valor 0 / undefined = sem pulso.
   */
  pulseVersion?: number;
  /**
   * Chave de geometria para disparar transição suave quando o shape muda
   * sem remount (ex.: footprint de câmera ao mudar altitude).
   */
  geometryVersion?: string | null;
} & PolygonProps;

/** Área de mapeamento: fade de entrada + pulso de edição + transição de geometria. */
export function MappingPolygonAnimated({
  enableEnter = true,
  pulseVersion,
  geometryVersion,
  pathOptions,
  ...rest
}: MappingPolygonProps) {
  const ref = useRef<LeafletPolygon | null>(null);
  const lastCleanup = useRef<(() => void) | void>(undefined);
  const didEnter = useRef(false);
  const reduced = useMemo(
    () => (typeof window === "undefined" ? false : prefersReducedMapMotion()),
    [],
  );
  const fillOp =
    (pathOptions as { fillOpacity?: number })?.fillOpacity ?? 0.18;
  const strokeW = (pathOptions as { weight?: number })?.weight ?? 2;

  // ── Fade de entrada ──────────────────────────────────────────
  useLayoutEffect(() => {
    if (!enableEnter) {
      return () => { lastCleanup.current?.(); };
    }
    const r = ref.current;
    if (!r) return () => { lastCleanup.current?.(); };

    const onAdd = () => {
      if (didEnter.current) return;
      const el = getLeafletPathSvgEl(r);
      if (!el || el.tagName.toLowerCase() !== "path") return;
      didEnter.current = true;
      lastCleanup.current?.();
      const fillOpacity = typeof fillOp === "number" ? fillOp : 0.18;
      const path = el as SVGPathElement;
      const strokeO = Number.isFinite(strokeW) && strokeW > 0 ? 1 : 0.85;
      lastCleanup.current = runPolygonFadeIn(path, {
        reduced,
        fillOpacity,
        strokeOpacity: strokeO,
        durationMs: POLYGON_FADE_MS,
      });
    };

    r.on("add", onAdd);
    if (getLeafletPathSvgEl(r)) onAdd();
    return () => {
      r.off("add", onAdd);
      lastCleanup.current?.();
    };
  }, [enableEnter, fillOp, reduced, strokeW, rest.positions]);

  // ── Pulso no contorno ao editar vértice ──────────────────────
  const prevPulseVersion = useRef<number | undefined>(undefined);
  const pulseCleanup = useRef<(() => void) | void>(undefined);

  useLayoutEffect(() => {
    const pv = pulseVersion ?? 0;
    if (prevPulseVersion.current === undefined) {
      prevPulseVersion.current = pv;
      return;
    }
    if (pv === 0 || pv === prevPulseVersion.current) {
      prevPulseVersion.current = pv;
      return;
    }
    prevPulseVersion.current = pv;
    if (!didEnter.current) return;
    const r = ref.current;
    if (!r) return;
    const el = getLeafletPathSvgEl(r);
    if (!el || el.tagName.toLowerCase() !== "path") return;
    pulseCleanup.current?.();
    pulseCleanup.current = runPolygonOutlinePulse(el as SVGPathElement, { reduced });
  }, [pulseVersion, reduced]);

  // ── Transição suave de geometria (ex.: FOV footprint muda) ───
  const prevGeometryVersion = useRef<string | null | undefined>(undefined);
  const geomCleanup = useRef<(() => void) | void>(undefined);

  useLayoutEffect(() => {
    const gv = geometryVersion ?? null;
    if (prevGeometryVersion.current === undefined) {
      prevGeometryVersion.current = gv;
      return;
    }
    if (gv === prevGeometryVersion.current) return;
    prevGeometryVersion.current = gv;
    if (!gv || !didEnter.current) return;
    const r = ref.current;
    if (!r) return;
    const el = getLeafletPathSvgEl(r);
    if (!el || el.tagName.toLowerCase() !== "path") return;
    geomCleanup.current?.();
    const fillOpacity = typeof fillOp === "number" ? fillOp : 0.18;
    geomCleanup.current = runPolygonGeometryTransition(el as SVGPathElement, {
      reduced,
      fillOpacity,
      strokeOpacity: 0.85,
    });
  }, [geometryVersion, fillOp, reduced]);

  return <Polygon ref={ref} pathOptions={pathOptions} {...rest} />;
}

// ─────────────────────────────────────────────────────────────────
// RoutePolylineAnimated
// ─────────────────────────────────────────────────────────────────

type RouteLineProps = {
  waypointIdSig: string;
  waypointsCount: number;
} & PolylineProps;

/**
 * Rota: draw-reveal quando waypoint ids mudam;
 * sem re-animação em arrasto simples (mesmos ids, posição muda).
 */
export function RoutePolylineAnimated({
  waypointIdSig,
  waypointsCount,
  pathOptions,
  ...rest
}: RouteLineProps) {
  const ref = useRef<LeafletPolyline | null>(null);
  const lastSig = useRef<string | null>(null);
  const lastPosHash = useRef<string | null>(null);
  const reduced = useMemo(
    () => (typeof window === "undefined" ? false : prefersReducedMapMotion()),
    [],
  );
  const cleanupRef = useRef<(() => void) | void>(undefined);
  const posHash = useMemo(
    () => hashPolylinePositions(rest.positions),
    [rest.positions],
  );

  const lineOpacity = useMemo((): number => {
    const o = (pathOptions as { opacity?: number } | undefined)?.opacity;
    return typeof o === "number" && Number.isFinite(o) ? o : 0.92;
  }, [pathOptions]);

  useLayoutEffect(() => {
    if (waypointsCount < 2) {
      lastSig.current = null;
      lastPosHash.current = null;
      return;
    }

    const l = ref.current;
    if (!l) return;

    const onLayerReady = () => {
      const el = getLeafletPathSvgEl(l);
      if (!el || el.tagName.toLowerCase() !== "path") return;
      const path = el as SVGPathElement;
      if (!posHash) return;

      if (
        lastSig.current != null &&
        lastPosHash.current != null &&
        waypointIdSig === lastSig.current &&
        posHash === lastPosHash.current
      ) {
        return;
      }

      // Mesmos ids, posição mudou (arrasto individual) — apenas atualiza sem animar.
      if (waypointIdSig === (lastSig.current ?? "") && posHash !== (lastPosHash.current ?? "")) {
        lastPosHash.current = posHash;
        cleanupRef.current?.();
        path.removeAttribute("style");
        return;
      }

      lastSig.current = waypointIdSig;
      lastPosHash.current = posHash;

      cleanupRef.current?.();
      cleanupRef.current = runPolylineDrawReveal(path, {
        durationMs: reduced ? 0 : ROUTE_DRAW_MS,
        reduced,
        finalLineOpacity: lineOpacity,
      });
    };

    l.on("add", onLayerReady);
    if (getLeafletPathSvgEl(l)) requestAnimationFrame(onLayerReady);
    return () => {
      l.off("add", onLayerReady);
      cleanupRef.current?.();
    };
  }, [lineOpacity, posHash, reduced, waypointIdSig, waypointsCount]);

  return <Polyline ref={ref} pathOptions={pathOptions} {...rest} />;
}

// ─────────────────────────────────────────────────────────────────
// StripPolylineAnimated
// ─────────────────────────────────────────────────────────────────

type StripLineProps = {
  staggerIndex: number;
  /** Total de strips na varredura; usado para calcular delay proporcional. */
  totalStrips?: number;
  /** Se true, aplica fade-out de saída em vez de animação de entrada. */
  isExiting?: boolean;
} & PolylineProps;

export function StripPolylineAnimated({
  staggerIndex,
  totalStrips,
  isExiting = false,
  pathOptions,
  ...rest
}: StripLineProps) {
  const ref = useRef<LeafletPolyline | null>(null);
  const didRun = useRef(false);
  const reduced = useMemo(
    () => (typeof window === "undefined" ? false : prefersReducedMapMotion()),
    [],
  );
  const lineOpacity = useMemo((): number => {
    const o = (pathOptions as { opacity?: number } | undefined)?.opacity;
    return typeof o === "number" && Number.isFinite(o) ? o : 0.75;
  }, [pathOptions]);
  const cleanupRef = useRef<(() => void) | void>(undefined);

  // ── Animação de saída (fade-out) ──────────────────────────────
  useLayoutEffect(() => {
    if (!isExiting) return;
    const l = ref.current;
    if (!l) return;

    const runExit = () => {
      const el = getLeafletPathSvgEl(l);
      if (!el || el.tagName.toLowerCase() !== "path") return;
      cleanupRef.current?.();
      cleanupRef.current = runPolylineFadeOut(el as SVGPathElement, {
        durationMs: motion.duration.stripFadeOut,
        reduced,
      });
    };

    l.on("add", runExit);
    if (getLeafletPathSvgEl(l)) requestAnimationFrame(runExit);
    return () => {
      l.off("add", runExit);
      cleanupRef.current?.();
    };
  }, [isExiting, reduced]);

  // ── Animação de entrada (draw-reveal com stagger proporcional) ─
  useLayoutEffect(() => {
    if (isExiting) return;
    if (didRun.current) return;

    const l = ref.current;
    if (!l) return;

    const total = totalStrips ?? 0;
    const delay = stripStaggerDelay(staggerIndex, total > 0 ? total : staggerIndex + 1, reduced);

    let t: ReturnType<typeof setTimeout> | null = null;

    const go = () => {
      if (didRun.current) return;
      const el = getLeafletPathSvgEl(l);
      if (!el || el.tagName.toLowerCase() !== "path") return;
      cleanupRef.current?.();
      cleanupRef.current = runPolylineDrawReveal(el as SVGPathElement, {
        durationMs: reduced ? 0 : STRIP_DRAW_MS,
        reduced,
        finalLineOpacity: lineOpacity,
      });
      didRun.current = true;
    };

    const schedule = () => {
      if (t) clearTimeout(t);
      t = delay > 0
        ? setTimeout(() => { t = null; go(); }, delay)
        : (go(), null);
    };

    l.on("add", schedule);
    if (getLeafletPathSvgEl(l)) {
      schedule();
    }

    return () => {
      l.off("add", schedule);
      if (t) clearTimeout(t);
    };
  }, [isExiting, lineOpacity, reduced, staggerIndex, totalStrips, rest.positions]);

  return <Polyline ref={ref} pathOptions={pathOptions} {...rest} />;
}

// ─────────────────────────────────────────────────────────────────
// SweepScanLineAnimated
// ─────────────────────────────────────────────────────────────────

/** Atraso antes de iniciar a linha de varredura (ms); aguarda strips animarem. */
const SWEEP_START_DELAY_MS = motion.duration.sweepStart;
const SWEEP_DRAW_MS = motion.duration.sweepDraw;
const SWEEP_HOLD_MS = motion.duration.sweepHold;
const SWEEP_FADE_MS = motion.duration.sweepFade;

type SweepScanLineProps = {
  /** Posições [lat, lng] conectando os centros dos strips — caminho de varredura. */
  positions: [number, number][];
};

/**
 * Linha de varredura animada: após os strips aparecerem, desenha uma linha translúcida
 * passando pelo centro de cada strip, revelando a direção de varredura da missão.
 * Monta com opacity 0, faz draw-reveal, aguarda e some com fade-out.
 * Deve ser montada com `key={stripsAnimVersion}` para re-animar em cada recálculo.
 */
export function SweepScanLineAnimated({ positions }: SweepScanLineProps) {
  const ref = useRef<LeafletPolyline | null>(null);
  const reduced = useMemo(
    () => (typeof window === "undefined" ? false : prefersReducedMapMotion()),
    [],
  );

  useLayoutEffect(() => {
    if (reduced || positions.length < 2) return;
    const l = ref.current;
    if (!l) return;

    let cleanupDraw: (() => void) | void;
    let t1: ReturnType<typeof setTimeout>;
    let t2: ReturnType<typeof setTimeout>;
    let t3: ReturnType<typeof setTimeout>;

    const start = () => {
      const el = getLeafletPathSvgEl(l);
      if (!el || el.tagName.toLowerCase() !== "path") return;
      const path = el as SVGPathElement;

      t1 = setTimeout(() => {
        cleanupDraw = runPolylineDrawReveal(path, {
          durationMs: SWEEP_DRAW_MS,
          reduced: false,
          finalLineOpacity: 0.7,
        });

        t2 = setTimeout(() => {
          path.style.transition = `opacity ${SWEEP_FADE_MS}ms ease-out`;
          path.style.opacity = "0";
          t3 = setTimeout(() => {
            path.style.removeProperty("transition");
            // Deixa opacity 0 inline → pathOptions.opacity:0 toma conta
          }, SWEEP_FADE_MS + 60);
        }, SWEEP_DRAW_MS + SWEEP_HOLD_MS);
      }, SWEEP_START_DELAY_MS);
    };

    l.on("add", start);
    if (getLeafletPathSvgEl(l)) start();

    return () => {
      l.off("add", start);
      cleanupDraw?.();
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [reduced, positions]);

  return (
    <Polyline
      ref={ref}
      positions={positions}
      pathOptions={{
        color: "#38bdf8",
        weight: 2,
        opacity: 0,
        dashArray: "7 5",
        interactive: false,
      }}
    />
  );
}
