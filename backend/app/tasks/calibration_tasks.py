from __future__ import annotations

from typing import Any
from uuid import UUID

from celery import shared_task
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.orm.attributes import flag_modified

from app.config import settings
from app.core.storage.file_manager import load_bytes_from_storage_key
from app.db.models.calibration_image import CalibrationImage
from app.db.models.calibration_session import CalibrationSession
from app.services.calibration.calibration_grid import (
    apply_primary_slots_to_grid,
    grid_slot_summary,
    reset_slots_to_empty,
)
from app.services.calibration.exif_aggregate import build_exif_report
from app.services.image_quality.analyze import analyze_bgr, decode_jpeg_bgr
from app.services.image_quality.features import orb_good_match_ratio
from app.services.image_quality.report import build_pixel_report
from app.services.image_quality.slot_aggregate import apply_slot_patches_to_grid, compute_slot_pixel_bundle

sync_engine = create_engine(settings.sync_database_url, future=True)
SyncSessionLocal = sessionmaker(bind=sync_engine, autoflush=False, autocommit=False, class_=Session)


def _iso_from_exif(exif: dict[str, Any]) -> int | None:
    v = exif.get("iso")
    if v is None:
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def _sort_images_for_sequence(rows: list[CalibrationImage]) -> list[CalibrationImage]:
    def key(img: CalibrationImage) -> tuple[str, str]:
        ex = dict(img.exif or {})
        dt = str(ex.get("datetime_original_parsed") or ex.get("datetime_original") or "")
        return (dt, img.filename)

    return sorted(rows, key=key)


@shared_task(acks_late=True)
def analyze_exif_task(session_id: str) -> dict:
    sid = UUID(session_id)
    with SyncSessionLocal() as db:
        session = db.get(CalibrationSession, sid)
        if not session:
            return {"ok": False, "detail": "session_not_found"}
        rows = db.scalars(select(CalibrationImage).where(CalibrationImage.session_id == sid)).all()
        exif_rows = [dict(img.exif) for img in rows]
        try:
            report = build_exif_report(exif_rows, dict(session.params_snapshot or {}))
            grid = session.theoretical_grid
            if isinstance(grid, dict) and grid.get("slots"):
                reset_slots_to_empty(grid)
                assigns = [
                    (str(img.id), img.primary_slot_id)
                    for img in rows
                    if getattr(img, "primary_slot_id", None)
                ]
                apply_primary_slots_to_grid(grid, assigns)
                flag_modified(session, "theoretical_grid")
                report = dict(report)
                report["calibration_grid"] = {"slot_counts": grid_slot_summary(grid)}
            session.exif_report = report
            session.status = "analyzing"
        except Exception as exc:  # noqa: BLE001
            session.status = "failed"
            session.exif_report = {
                "version": 1,
                "error": str(exc),
                "summary": {"image_count": len(rows)},
                "metrics": [],
            }
        db.commit()
        if session.status != "failed":
            analyze_pixels_task.delay(session_id)
    return {"ok": True, "session_id": session_id}


@shared_task(acks_late=True)
def analyze_pixels_task(session_id: str) -> dict:
    sid = UUID(session_id)
    with SyncSessionLocal() as db:
        session = db.get(CalibrationSession, sid)
        if not session:
            return {"ok": False, "detail": "session_not_found"}
        rows = db.scalars(select(CalibrationImage).where(CalibrationImage.session_id == sid)).all()
        for im in rows:
            im.is_best_for_slot = False
        ordered = _sort_images_for_sequence(rows)
        filenames = [r.filename for r in ordered]
        per_image: list[dict[str, Any] | None] = []
        bgr_by_index: dict[int, Any] = {}

        for i, row in enumerate(ordered):
            key = row.thumbnail_storage_key or row.storage_key
            raw = load_bytes_from_storage_key(key)
            if not raw:
                per_image.append(None)
                continue
            bgr = decode_jpeg_bgr(raw)
            if bgr is None:
                per_image.append(None)
                continue
            per_image.append(analyze_bgr(bgr))
            bgr_by_index[i] = bgr

        pairwise: list[dict[str, Any]] = []
        for i in range(len(ordered) - 1):
            b_a = bgr_by_index.get(i)
            b_b = bgr_by_index.get(i + 1)
            if b_a is None or b_b is None:
                continue
            m = orb_good_match_ratio(b_a, b_b)
            pairwise.append(
                {
                    "index_a": i,
                    "index_b": i + 1,
                    "filename_a": filenames[i],
                    "filename_b": filenames[i + 1],
                    **m,
                }
            )

        iso_by_index = [_iso_from_exif(dict(row.exif or {})) for row in ordered]
        grid_doc = session.theoretical_grid if isinstance(session.theoretical_grid, dict) else None

        ordered_triples: list[tuple[UUID, str, str | None]] = [
            (r.id, r.filename, r.primary_slot_id) for r in ordered
        ]

        slot_reports: list[dict[str, Any]] = []
        try:
            slot_reports, slot_patches, best_flags, _stream_events = compute_slot_pixel_bundle(
                grid_doc,
                ordered_triples,
                per_image,
                bgr_by_index,
            )
            if grid_doc is not None and slot_patches:
                apply_slot_patches_to_grid(grid_doc, slot_patches)
                flag_modified(session, "theoretical_grid")
                if session.exif_report and isinstance(session.exif_report, dict):
                    er = dict(session.exif_report)
                    cg = dict(er.get("calibration_grid") or {})
                    cg["slot_counts"] = grid_slot_summary(grid_doc)
                    er["calibration_grid"] = cg
                    session.exif_report = er

            pixel_report = build_pixel_report(filenames, per_image, pairwise, iso_by_index, slot_reports)
            session.pixel_report = pixel_report

            for row in ordered:
                if best_flags.get(row.id):
                    row.is_best_for_slot = True
        except Exception as exc:  # noqa: BLE001
            session.pixel_report = {
                "version": 1,
                "error": str(exc),
                "summary": {"image_count": len(filenames)},
                "per_image": [],
                "pairwise_orb": pairwise,
                "slot_reports": slot_reports,
                "metrics": [],
            }
        session.status = "ready"
        db.commit()
    return {"ok": True, "session_id": session_id}
