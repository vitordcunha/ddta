"""Per-slot pixel metrics, best-photo selection, neighbour ORB overlap (Fase 4)."""

from __future__ import annotations

from collections import defaultdict
from statistics import median
from typing import Any
from uuid import UUID

import numpy as np

from app.services.image_quality.features import orb_good_match_ratio


def _composite_score(metrics: dict[str, Any], med_lap: float) -> float:
    """Higher is better (sharp, low clipping, low shadow noise)."""
    lap = float(metrics["laplacian_var_center"])
    blur_n = min(1.0, lap / max(med_lap * 1.5, 20.0))
    exp = metrics["exposure"]
    clip = max(float(exp[c]["frac_at_255"]) for c in ("b", "g", "r"))
    clip_n = max(0.0, 1.0 - min(1.0, clip / 0.12))
    sn = metrics.get("shadow") or {}
    sstd = sn.get("shadow_luma_std")
    if sstd is None:
        noise_n = 0.7
    else:
        noise_n = max(0.0, 1.0 - min(1.0, float(sstd) / 45.0))
    return 0.5 * blur_n + 0.3 * clip_n + 0.2 * noise_n


def _clipping_ratio(metrics: dict[str, Any]) -> float:
    exp = metrics["exposure"]
    return max(float(exp[c]["frac_at_255"]) for c in ("b", "g", "r"))


def _shadow_noise(metrics: dict[str, Any]) -> float | None:
    sn = metrics.get("shadow") or {}
    v = sn.get("shadow_luma_std")
    return float(v) if v is not None else None


def _neighbor_offsets() -> list[tuple[int, int]]:
    return [(-1, 0), (1, 0), (0, -1), (0, 1)]


def compute_slot_pixel_bundle(
    grid_doc: dict[str, Any] | None,
    ordered_images: list[tuple[UUID, str, str | None]],
    per_image: list[dict[str, Any] | None],
    bgr_by_index: dict[int, np.ndarray],
) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]], dict[UUID, bool], list[dict[str, Any]]]:
    """
    Args:
        grid_doc: ``theoretical_grid`` JSON from session.
        ordered_images: ``(image_id, filename, primary_slot_id)`` in analysis order (same as ``per_image``).
        per_image: parallel to ``ordered_images``; ``None`` if decode failed.
        bgr_by_index: indices with decoded BGR arrays.

    Returns:
        ``slot_reports``, ``slot_patches`` (merge into grid slots), ``is_best_for_slot`` per image UUID,
        ``stream_events`` for SSE ``slot_scored``.
    """
    slot_reports: list[dict[str, Any]] = []
    slot_patches: dict[str, dict[str, Any]] = {}
    stream_events: list[dict[str, Any]] = []
    best_flags: dict[UUID, bool] = {}

    for uid, _, _ in ordered_images:
        best_flags[uid] = False

    if not grid_doc or not isinstance(grid_doc.get("slots"), list):
        return slot_reports, slot_patches, best_flags, stream_events

    slots = [s for s in grid_doc["slots"] if isinstance(s, dict) and s.get("id")]
    slot_by_id: dict[str, dict[str, Any]] = {str(s["id"]): s for s in slots}

    ok_idx = [i for i, row in enumerate(per_image) if row is not None]
    if not ok_idx:
        for sid, s in slot_by_id.items():
            st = str(s.get("status") or "empty")
            if st == "gap":
                slot_reports.append(
                    {
                        "slot_id": sid,
                        "row": int(s.get("row") or 0),
                        "col": int(s.get("col") or 0),
                        "best_image_id": None,
                        "best_score": None,
                        "blur_score": None,
                        "clipping_ratio": None,
                        "shadow_noise": None,
                        "n_photos_covering": 0,
                        "feature_overlap_with_neighbors": None,
                        "status": "gap",
                    }
                )
        return slot_reports, slot_patches, best_flags, stream_events

    laps = [float(per_image[i]["laplacian_var_center"]) for i in ok_idx]  # type: ignore[index]
    med_lap = float(median(laps)) if laps else 1.0

    by_slot: dict[str, list[tuple[int, UUID, dict[str, Any]]]] = defaultdict(list)
    for i, (img_id, _fn, slot_id) in enumerate(ordered_images):
        if not slot_id or per_image[i] is None:
            continue
        row_m = per_image[i]
        assert row_m is not None
        by_slot[str(slot_id)].append((i, img_id, row_m))

    best_by_slot: dict[str, tuple[UUID, float, dict[str, Any], int]] = {}
    for sid, candidates in by_slot.items():
        best: tuple[UUID, float, dict[str, Any], int] | None = None
        for idx, img_id, metrics in candidates:
            sc = _composite_score(metrics, med_lap)
            if best is None or sc > best[1]:
                best = (img_id, sc, metrics, idx)
        if best:
            best_by_slot[sid] = best

    rc_by_id: dict[str, tuple[int, int]] = {}
    for s in slots:
        sid = str(s.get("id") or "")
        if sid:
            rc_by_id[sid] = (int(s.get("row") or 0), int(s.get("col") or 0))

    def neighbors_same_grid(sid: str) -> list[str]:
        if sid not in rc_by_id:
            return []
        r0, c0 = rc_by_id[sid]
        out: list[str] = []
        for dr, dc in _neighbor_offsets():
            for other_id, (r1, c1) in rc_by_id.items():
                if other_id == sid:
                    continue
                if r1 == r0 + dr and c1 == c0 + dc:
                    out.append(other_id)
        return out

    neighbor_ratios: dict[str, list[float]] = defaultdict(list)
    for sid, (_, _, _, idx_a) in best_by_slot.items():
        b_a = bgr_by_index.get(idx_a)
        if b_a is None:
            continue
        for nid in neighbors_same_grid(sid):
            if nid not in best_by_slot:
                continue
            _bid, _sc, _m, idx_b = best_by_slot[nid]
            b_b = bgr_by_index.get(idx_b)
            if b_b is None:
                continue
            m = orb_good_match_ratio(b_a, b_b)
            neighbor_ratios[sid].append(float(m["match_ratio"]))

    # First pass: build slot_reports with status in {gap, warning, critical, covered}; not "best" yet
    pending_for_best: list[tuple[str, float]] = []

    for s in slots:
        sid = str(s.get("id") or "")
        row = int(s.get("row") or 0)
        col = int(s.get("col") or 0)
        gps_status = str(s.get("status") or "empty")

        if gps_status == "gap":
            sr = {
                "slot_id": sid,
                "row": row,
                "col": col,
                "best_image_id": None,
                "best_score": None,
                "blur_score": None,
                "clipping_ratio": None,
                "shadow_noise": None,
                "n_photos_covering": 0,
                "feature_overlap_with_neighbors": None,
                "status": "gap",
            }
            slot_reports.append(sr)
            slot_patches[sid] = {
                "best_image_id": None,
                "blur_score": None,
                "clipping_ratio": None,
                "shadow_noise": None,
                "feature_overlap_with_neighbors": None,
                "n_photos_covering": 0,
                "best_score": None,
                "status": "gap",
            }
            stream_events.append({"slotId": sid, "score": None, "status": "gap"})
            continue

        if sid not in best_by_slot:
            sr = {
                "slot_id": sid,
                "row": row,
                "col": col,
                "best_image_id": str(s.get("primary_image_id") or "") or None,
                "best_score": None,
                "blur_score": None,
                "clipping_ratio": None,
                "shadow_noise": None,
                "n_photos_covering": len(by_slot.get(sid, [])),
                "feature_overlap_with_neighbors": None,
                "status": "warning",
            }
            slot_reports.append(sr)
            slot_patches[sid] = {
                "best_image_id": s.get("primary_image_id"),
                "blur_score": None,
                "clipping_ratio": None,
                "shadow_noise": None,
                "feature_overlap_with_neighbors": None,
                "n_photos_covering": len(by_slot.get(sid, [])),
                "best_score": None,
                "status": "warning",
            }
            stream_events.append({"slotId": sid, "score": None, "status": "warning"})
            continue

        img_id, best_sc, metrics, _idx = best_by_slot[sid]
        lap = float(metrics["laplacian_var_center"])
        clip = _clipping_ratio(metrics)
        shn = _shadow_noise(metrics)
        ratios = neighbor_ratios.get(sid, [])
        feat_min = float(min(ratios)) if ratios else None

        n_cov = len(by_slot.get(sid, []))

        critical = clip > 0.12 or lap < max(12.0, 0.22 * med_lap)
        low_orb = feat_min is not None and len(ratios) >= 1 and feat_min < 0.035
        warn = (
            not critical
            and (
                clip > 0.04
                or lap < max(20.0, 0.48 * med_lap)
                or low_orb
                or (shn is not None and shn > 32.0)
            )
        )

        if critical:
            st = "critical"
        elif low_orb and not critical:
            st = "warning"
        elif warn:
            st = "warning"
        else:
            st = "covered"
            pending_for_best.append((sid, best_sc))

        sr = {
            "slot_id": sid,
            "row": row,
            "col": col,
            "best_image_id": str(img_id),
            "best_score": round(best_sc, 5),
            "blur_score": round(lap, 4),
            "clipping_ratio": round(clip, 5),
            "shadow_noise": round(shn, 3) if shn is not None else None,
            "n_photos_covering": n_cov,
            "feature_overlap_with_neighbors": round(feat_min, 5) if feat_min is not None else None,
            "status": st,
        }
        slot_reports.append(sr)
        slot_patches[sid] = {
            "best_image_id": str(img_id),
            "blur_score": sr["blur_score"],
            "clipping_ratio": sr["clipping_ratio"],
            "shadow_noise": shn,
            "feature_overlap_with_neighbors": feat_min,
            "n_photos_covering": n_cov,
            "best_score": sr["best_score"],
            "status": st,
        }
        stream_events.append({"slotId": sid, "score": sr["best_score"], "status": st})
        best_flags[img_id] = True

    # Global "best" badge: strongest non-critical slot (prefer strict covered, else highest score)
    covered_only = [(sid, sc) for sid, sc in pending_for_best]
    best_session_sid: str | None = None
    if covered_only:
        best_session_sid = max(covered_only, key=lambda t: t[1])[0]
    elif pending_for_best:
        # fallback: upgrade best among slots that were "covered" before OR use any with image
        slot_score_map = {str(r["slot_id"]): float(r["best_score"] or 0) for r in slot_reports if r.get("best_score")}
        non_crit = [
            r["slot_id"]
            for r in slot_reports
            if r.get("status") not in ("gap", "critical") and r.get("best_score") is not None
        ]
        if non_crit:
            best_session_sid = max(non_crit, key=lambda sid: slot_score_map.get(str(sid), 0.0))

    if best_session_sid:
        for r in slot_reports:
            if str(r["slot_id"]) == best_session_sid and r.get("status") == "covered":
                r["status"] = "best"
        if best_session_sid in slot_patches and slot_patches[best_session_sid].get("status") == "covered":
            slot_patches[best_session_sid]["status"] = "best"
        for i, ev in enumerate(stream_events):
            if ev.get("slotId") == best_session_sid and ev.get("status") == "covered":
                stream_events[i] = {**ev, "status": "best"}

    slot_reports.sort(key=lambda r: (r["row"], r["col"]))
    return slot_reports, slot_patches, best_flags, stream_events


def apply_slot_patches_to_grid(grid_doc: dict[str, Any], patches: dict[str, dict[str, Any]]) -> None:
    """Mutates ``grid_doc['slots']`` in place."""
    slots = grid_doc.get("slots")
    if not isinstance(slots, list):
        return
    for s in slots:
        if not isinstance(s, dict):
            continue
        sid = str(s.get("id") or "")
        if sid in patches:
            s.update(patches[sid])
