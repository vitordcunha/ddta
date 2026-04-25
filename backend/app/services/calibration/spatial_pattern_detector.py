"""Spatial pattern detection over calibration grid slot reports (Fase 5)."""

from __future__ import annotations

import math
from typing import Any


def _pearson(xs: list[float], ys: list[float]) -> float:
    """Pearson correlation coefficient; returns 0.0 on degenerate input."""
    n = len(xs)
    if n < 3:
        return 0.0
    mx = sum(xs) / n
    my = sum(ys) / n
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    dx = math.sqrt(sum((x - mx) ** 2 for x in xs))
    dy = math.sqrt(sum((y - my) ** 2 for y in ys))
    if dx < 1e-10 or dy < 1e-10:
        return 0.0
    return num / (dx * dy)


def _slot_id(sr: dict[str, Any]) -> str:
    return str(sr.get("slot_id") or "")


def _blur(sr: dict[str, Any]) -> float | None:
    v = sr.get("blur_score")
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _is_gap(sr: dict[str, Any]) -> bool:
    return str(sr.get("status", "")).lower() == "gap"


def _orb(sr: dict[str, Any]) -> float | None:
    v = sr.get("feature_overlap_with_neighbors")
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def detect_spatial_patterns(
    slot_reports: list[dict[str, Any]],
    grid_meta: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """
    Analyze per-slot metrics for spatial patterns across the calibration grid.

    Returns list of detected patterns, each::

        {
            "type": str,
            "confidence": float,          # 0..1
            "affected_slot_ids": list[str],
            "description": str,
            "axis": str | None,           # "north"/"south"/"east"/"west" / "row"/"col"
        }
    """
    if not slot_reports:
        return []

    by_rc: dict[tuple[int, int], dict[str, Any]] = {}
    for sr in slot_reports:
        r, c = int(sr.get("row", 0)), int(sr.get("col", 0))
        by_rc[(r, c)] = sr

    rows = sorted({k[0] for k in by_rc})
    cols = sorted({k[1] for k in by_rc})
    if not rows or not cols:
        return []

    patterns: list[dict[str, Any]] = []
    patterns.extend(_detect_edge_blur(by_rc, rows, cols))
    patterns.extend(_detect_alternating_strips(by_rc, rows, cols))
    patterns.extend(_detect_progressive_gradient(by_rc, rows, cols))
    patterns.extend(_detect_gap_cluster(by_rc, rows, cols))
    patterns.extend(_detect_feature_starvation(by_rc, rows, cols))
    return patterns


# ── 1. Edge blur concentration ─────────────────────────────────────────────────

def _detect_edge_blur(
    by_rc: dict[tuple[int, int], dict[str, Any]],
    rows: list[int],
    cols: list[int],
) -> list[dict[str, Any]]:
    if len(rows) < 3 or len(cols) < 3:
        return []

    def _mean_blur(rcs: list[tuple[int, int]]) -> float | None:
        vals = [_blur(by_rc[rc]) for rc in rcs if rc in by_rc]
        vals = [v for v in vals if v is not None]
        return sum(vals) / len(vals) if vals else None

    center_rows = rows[1:-1]
    center_cols = cols[1:-1]
    center_blur = _mean_blur([(r, c) for r in center_rows for c in center_cols])
    if center_blur is None or center_blur < 1.0:
        return []

    edges = [
        ("north", [(rows[0], c) for c in cols]),
        ("south", [(rows[-1], c) for c in cols]),
        ("west",  [(r, cols[0]) for r in rows]),
        ("east",  [(r, cols[-1]) for r in rows]),
    ]
    results: list[dict[str, Any]] = []
    for axis, rcs in edges:
        edge_blur = _mean_blur(rcs)
        if edge_blur is None:
            continue
        ratio = edge_blur / center_blur
        if ratio >= 0.65:
            continue
        confidence = min(1.0, (1.0 - ratio) / 0.5)
        slot_ids = [_slot_id(by_rc[rc]) for rc in rcs if rc in by_rc and _slot_id(by_rc[rc])]
        results.append({
            "type": "edge_blur",
            "axis": axis,
            "confidence": round(confidence, 3),
            "affected_slot_ids": slot_ids,
            "description": (
                f"Desfoque concentrado na borda {axis} "
                f"(média borda ≈ {edge_blur:.1f} vs centro ≈ {center_blur:.1f}). "
                "Pode indicar sombra lateral, reflexo ou vento de proa nessa direção."
            ),
        })
    return results


# ── 2. Alternating strip pattern (auto-exposure between passes) ────────────────

def _detect_alternating_strips(
    by_rc: dict[tuple[int, int], dict[str, Any]],
    rows: list[int],
    cols: list[int],
) -> list[dict[str, Any]]:
    if len(rows) < 4:
        return []

    even_blurs: list[float] = []
    odd_blurs: list[float] = []
    even_ids: list[str] = []
    odd_ids: list[str] = []

    for i, r in enumerate(rows):
        for c in cols:
            sr = by_rc.get((r, c))
            if not sr:
                continue
            b = _blur(sr)
            if b is None:
                continue
            sid = _slot_id(sr)
            if i % 2 == 0:
                even_blurs.append(b)
                even_ids.append(sid)
            else:
                odd_blurs.append(b)
                odd_ids.append(sid)

    if not even_blurs or not odd_blurs:
        return []

    mean_even = sum(even_blurs) / len(even_blurs)
    mean_odd = sum(odd_blurs) / len(odd_blurs)
    max_mean = max(mean_even, mean_odd)
    if max_mean < 1.0:
        return []
    ratio = min(mean_even, mean_odd) / max_mean
    if ratio > 0.70:
        return []

    confidence = min(1.0, (1.0 - ratio) / 0.45)
    worse_ids = even_ids if mean_even < mean_odd else odd_ids
    return [{
        "type": "alternating_strips",
        "axis": "row",
        "confidence": round(confidence, 3),
        "affected_slot_ids": [s for s in worse_ids if s],
        "description": (
            f"Nitidez alterna entre faixas pares (≈ {mean_even:.1f}) e ímpares (≈ {mean_odd:.1f}). "
            "Padrão típico de auto-exposição compensando ao virar o drone no fim da faixa. "
            "Use modo manual de exposição."
        ),
    }]


# ── 3. Progressive blur gradient (row or col direction) ───────────────────────

def _detect_progressive_gradient(
    by_rc: dict[tuple[int, int], dict[str, Any]],
    rows: list[int],
    cols: list[int],
) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []

    row_means: list[tuple[float, float]] = []
    for idx, r in enumerate(rows):
        vals = [_blur(by_rc[(r, c)]) for c in cols if (r, c) in by_rc]
        vals = [v for v in vals if v is not None]
        if vals:
            row_means.append((float(idx), sum(vals) / len(vals)))

    if len(row_means) >= 4:
        xs, ys = zip(*row_means)
        corr = _pearson(list(xs), list(ys))
        if abs(corr) >= 0.65:
            direction = "melhora" if corr > 0 else "piora"
            axis_label = "norte→sul" if corr < 0 else "sul→norte"
            med = sorted(ys)[len(ys) // 2]
            bad_rows = [rows[int(x)] for x, y in row_means if y < med * 0.85]
            bad_ids = [
                _slot_id(by_rc[(r, c)])
                for r in bad_rows
                for c in cols
                if (r, c) in by_rc and _slot_id(by_rc[(r, c)])
            ]
            results.append({
                "type": "progressive_blur_row",
                "axis": "row",
                "confidence": round(min(1.0, (abs(corr) - 0.65) / 0.3), 3),
                "affected_slot_ids": bad_ids,
                "description": (
                    f"Desfoque {direction} progressivamente na direção {axis_label} "
                    f"(correlação de Pearson ≈ {corr:.2f}). "
                    "Pode indicar variação de altitude, vento ou contra-luz ao longo do percurso."
                ),
            })

    col_means: list[tuple[float, float]] = []
    for idx, c in enumerate(cols):
        vals = [_blur(by_rc[(r, c)]) for r in rows if (r, c) in by_rc]
        vals = [v for v in vals if v is not None]
        if vals:
            col_means.append((float(idx), sum(vals) / len(vals)))

    if len(col_means) >= 4:
        xs, ys = zip(*col_means)
        corr = _pearson(list(xs), list(ys))
        if abs(corr) >= 0.65:
            direction = "melhora" if corr > 0 else "piora"
            axis_label = "leste→oeste" if corr < 0 else "oeste→leste"
            med = sorted(ys)[len(ys) // 2]
            bad_cols = [cols[int(x)] for x, y in col_means if y < med * 0.85]
            bad_ids = [
                _slot_id(by_rc[(r, c)])
                for c in bad_cols
                for r in rows
                if (r, c) in by_rc and _slot_id(by_rc[(r, c)])
            ]
            results.append({
                "type": "progressive_blur_col",
                "axis": "col",
                "confidence": round(min(1.0, (abs(corr) - 0.65) / 0.3), 3),
                "affected_slot_ids": bad_ids,
                "description": (
                    f"Desfoque {direction} progressivamente na direção {axis_label} "
                    f"(correlação de Pearson ≈ {corr:.2f}). "
                    "Pode indicar contra-luz ou terreno inclinado nessa direção."
                ),
            })

    return results


# ── 4. Gap cluster (coverage holes concentrated on one edge) ──────────────────

def _detect_gap_cluster(
    by_rc: dict[tuple[int, int], dict[str, Any]],
    rows: list[int],
    cols: list[int],
) -> list[dict[str, Any]]:
    total_gaps = sum(1 for sr in by_rc.values() if _is_gap(sr))
    if total_gaps == 0:
        return []

    edges = {
        "north": [(rows[0], c) for c in cols],
        "south": [(rows[-1], c) for c in cols],
        "west":  [(r, cols[0]) for r in rows],
        "east":  [(r, cols[-1]) for r in rows],
    }
    results: list[dict[str, Any]] = []
    for axis, rcs in edges.items():
        edge_gaps = sum(1 for rc in rcs if rc in by_rc and _is_gap(by_rc[rc]))
        if edge_gaps == 0:
            continue
        fraction_of_total = edge_gaps / total_gaps
        edge_gap_rate = edge_gaps / max(len(rcs), 1)
        if fraction_of_total < 0.55 or edge_gap_rate < 0.4:
            continue
        slot_ids = [
            _slot_id(by_rc[rc])
            for rc in rcs
            if rc in by_rc and _is_gap(by_rc[rc]) and _slot_id(by_rc[rc])
        ]
        results.append({
            "type": "gap_cluster",
            "axis": axis,
            "confidence": round(min(1.0, fraction_of_total), 3),
            "affected_slot_ids": slot_ids,
            "description": (
                f"{edge_gaps} de {total_gaps} lacunas concentradas na borda {axis} "
                f"({edge_gap_rate * 100:.0f}% da borda sem foto primária). "
                "O drone possivelmente não chegou até a borda ou o obturador não ativou nessa faixa. "
                "Verifique a margem do polígono de calibração."
            ),
        })
    return results


# ── 5. Feature starvation in a contiguous strip ───────────────────────────────

def _detect_feature_starvation(
    by_rc: dict[tuple[int, int], dict[str, Any]],
    rows: list[int],
    cols: list[int],
) -> list[dict[str, Any]]:
    ORB_LOW = 0.04
    results: list[dict[str, Any]] = []

    for r in rows:
        rcs = [(r, c) for c in cols if (r, c) in by_rc]
        if len(rcs) < 2:
            continue
        orb_vals = [v for rc in rcs if (v := _orb(by_rc[rc])) is not None]
        if len(orb_vals) < 2:
            continue
        mean_orb = sum(orb_vals) / len(orb_vals)
        if mean_orb >= ORB_LOW:
            continue
        slot_ids = [_slot_id(by_rc[rc]) for rc in rcs if _slot_id(by_rc[rc])]
        results.append({
            "type": "feature_starvation",
            "axis": "row",
            "confidence": round(min(1.0, (ORB_LOW - mean_orb) / ORB_LOW), 3),
            "affected_slot_ids": slot_ids,
            "description": (
                f"Faixa (linha {r}) com ORB médio ≈ {mean_orb:.3f} entre slots vizinhos "
                f"(limiar {ORB_LOW}). Superfície com pouca textura (água, areia, cultura homogênea). "
                "Aumente o overlap lateral ou revise horário de voo."
            ),
        })

    for c in cols:
        rcs = [(r, c) for r in rows if (r, c) in by_rc]
        if len(rcs) < 2:
            continue
        orb_vals = [v for rc in rcs if (v := _orb(by_rc[rc])) is not None]
        if len(orb_vals) < 2:
            continue
        mean_orb = sum(orb_vals) / len(orb_vals)
        if mean_orb >= ORB_LOW:
            continue
        slot_ids = [_slot_id(by_rc[rc]) for rc in rcs if _slot_id(by_rc[rc])]
        results.append({
            "type": "feature_starvation",
            "axis": "col",
            "confidence": round(min(1.0, (ORB_LOW - mean_orb) / ORB_LOW), 3),
            "affected_slot_ids": slot_ids,
            "description": (
                f"Coluna {c} com ORB médio ≈ {mean_orb:.3f} entre slots vizinhos "
                f"(limiar {ORB_LOW}). Superfície com pouca textura. "
                "Considere aumentar o overlap lateral nessa área."
            ),
        })

    return results
