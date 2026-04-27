import { useCallback, useState } from "react";

const STORAGE_KEY = "dd-wind-indicator-prefs-v1";

export type WindIndicatorPrefs = {
  hidden: boolean;
  compact: boolean;
  /** Só aplica quando não está em modo compacto. */
  showGusts: boolean;
  /** Deslocamento vertical em px (positivo = desce) em relação à posição padrão do workspace. */
  offsetYPx: number;
};

const DEFAULTS: WindIndicatorPrefs = {
  hidden: false,
  compact: false,
  showGusts: true,
  offsetYPx: 0,
};

export function clampWindIndicatorOffsetYPx(px: number): number {
  if (!Number.isFinite(px)) return 0;
  const min = -200;
  const max =
    typeof window !== "undefined"
      ? Math.min(520, Math.round(window.innerHeight * 0.55))
      : 400;
  return Math.round(Math.max(min, Math.min(max, px)));
}

function readPrefs(): WindIndicatorPrefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const o = JSON.parse(raw) as Partial<WindIndicatorPrefs>;
    return {
      hidden: Boolean(o.hidden),
      compact: Boolean(o.compact),
      showGusts: o.showGusts !== false,
      offsetYPx: clampWindIndicatorOffsetYPx(
        typeof o.offsetYPx === "number" ? o.offsetYPx : DEFAULTS.offsetYPx,
      ),
    };
  } catch {
    return DEFAULTS;
  }
}

function writePrefs(p: WindIndicatorPrefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* ignore quota */
  }
}

export function useWindIndicatorPrefs(): [
  WindIndicatorPrefs,
  (patch: Partial<WindIndicatorPrefs>) => void,
] {
  const [prefs, setPrefs] = useState<WindIndicatorPrefs>(() => readPrefs());

  const patchPrefs = useCallback((patch: Partial<WindIndicatorPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      if (typeof patch.offsetYPx === "number") {
        next.offsetYPx = clampWindIndicatorOffsetYPx(patch.offsetYPx);
      }
      writePrefs(next);
      return next;
    });
  }, []);

  return [prefs, patchPrefs];
}
