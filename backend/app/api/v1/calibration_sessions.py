import asyncio
import json
from pathlib import Path
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified
from sse_starlette.sse import EventSourceResponse

from app.config import settings
from app.core.storage.file_manager import (
    get_calibration_session_dir,
    load_bytes_from_storage_key,
    upload_to_storage,
)
from app.db.models.calibration_image import CalibrationImage
from app.db.models.calibration_session import CalibrationSession
from app.dependencies import get_db
from app.schemas.calibration import (
    CalibrationImageSummary,
    CalibrationRecommendation,
    CalibrationSessionDetail,
    CalibrationSessionFullReport,
    CalibrationUploadResponse,
)
from app.services.recommendation_engine import build_recommendations
from app.services.calibration.calibration_grid import (
    apply_primary_slots_to_grid,
    approx_photo_footprint_polygon,
    assign_image_to_slot,
    reset_slots_to_empty,
)
from app.services.calibration.exif_extract import extract_calibration_exif
from app.services.calibration.thumbnail import (
    build_calibration_small_thumbnail_jpeg,
    build_calibration_thumbnail_jpeg,
)
from app.tasks.calibration_tasks import analyze_exif_task
from app.utils.rate_limit import limiter

router = APIRouter(prefix="/calibration-sessions", tags=["calibration-sessions"])

JPEG_MAGIC = b"\xff\xd8\xff"


def _recommendation_models(session: CalibrationSession) -> list[CalibrationRecommendation]:
    raw = build_recommendations(
        dict(session.params_snapshot or {}),
        None,
        session.exif_report,
        session.pixel_report,
    )
    return [CalibrationRecommendation.model_validate(r) for r in raw]


def _session_detail(session: CalibrationSession) -> CalibrationSessionDetail:
    return CalibrationSessionDetail(
        id=session.id,
        project_id=session.project_id,
        status=session.status,
        created_at=session.created_at,
        updated_at=session.updated_at,
        polygon_snapshot=session.polygon_snapshot,
        exif_report=session.exif_report,
        pixel_report=session.pixel_report,
        theoretical_grid=session.theoretical_grid,
        recommendations=_recommendation_models(session),
    )


def _exif_public_subset(exif: dict[str, Any] | None) -> dict[str, Any]:
    if not exif:
        return {}
    keys = (
        "gps_latitude",
        "gps_longitude",
        "gps_altitude_m",
        "iso",
        "exposure_time_s",
        "f_number",
        "datetime_original",
    )
    return {k: exif[k] for k in keys if k in exif}


def _as_float(v: object | None) -> float | None:
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _safe_filename(name: str | None) -> str:
    base = Path(name or "image.jpg").name
    if not base or base.strip() in {".", ".."} or "/" in base or "\\" in base:
        return "image.jpg"
    return base[:500]


@router.get("/{session_id}", response_model=CalibrationSessionDetail)
async def get_calibration_session(
    session_id: UUID, db: AsyncSession = Depends(get_db)
) -> CalibrationSessionDetail:
    row = await db.get(CalibrationSession, session_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Calibration session not found")
    return _session_detail(row)


@router.get("/{session_id}/report", response_model=CalibrationSessionFullReport)
async def get_calibration_session_report(
    session_id: UUID, db: AsyncSession = Depends(get_db)
) -> CalibrationSessionFullReport:
    row = await db.get(CalibrationSession, session_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Calibration session not found")
    return CalibrationSessionFullReport(
        session_id=row.id,
        status=row.status,
        polygon_snapshot=row.polygon_snapshot,
        exif_report=row.exif_report,
        pixel_report=row.pixel_report,
        theoretical_grid=row.theoretical_grid,
        recommendations=_recommendation_models(row),
    )


@router.get("/{session_id}/images", response_model=list[CalibrationImageSummary])
async def list_calibration_images(
    session_id: UUID, db: AsyncSession = Depends(get_db)
) -> list[CalibrationImageSummary]:
    session = await db.get(CalibrationSession, session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Calibration session not found")
    rows = (await db.scalars(select(CalibrationImage).where(CalibrationImage.session_id == session_id))).all()
    return [
        CalibrationImageSummary(
            id=r.id,
            filename=r.filename,
            primary_slot_id=r.primary_slot_id,
            is_best_for_slot=r.is_best_for_slot,
            exif=_exif_public_subset(dict(r.exif or {})),
            extras=dict(r.extras or {}),
        )
        for r in rows
    ]


@router.get("/{session_id}/images/{image_id}/thumbnail")
async def get_calibration_image_thumbnail(
    session_id: UUID,
    image_id: UUID,
    small: bool = False,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Return thumbnail JPEG.  Pass ``?small=true`` for the 320×240 preview."""
    session = await db.get(CalibrationSession, session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Calibration session not found")
    img = await db.get(CalibrationImage, image_id)
    if not img or img.session_id != session_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")
    if small:
        key = img.small_thumbnail_storage_key or img.thumbnail_storage_key or img.storage_key
    else:
        key = img.thumbnail_storage_key or img.storage_key
    raw = load_bytes_from_storage_key(key)
    if not raw:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thumbnail not available")
    return Response(content=raw, media_type="image/jpeg")


@router.get("/{session_id}/stream")
async def stream_calibration_session(session_id: UUID, db: AsyncSession = Depends(get_db)) -> EventSourceResponse:
    row = await db.get(CalibrationSession, session_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Calibration session not found")

    async def event_generator():
        terminal = {"ready", "failed"}
        sent_slot_scored_burst = False
        while True:
            r = await db.execute(select(CalibrationSession).where(CalibrationSession.id == session_id))
            current = r.scalar_one_or_none()
            if not current:
                yield {"event": "error", "data": json.dumps({"detail": "not_found"})}
                break
            if current.status == "ready" and not sent_slot_scored_burst:
                rep = current.pixel_report or {}
                slot_rows = rep.get("slot_reports") or []
                if slot_rows:
                    for sr in slot_rows:
                        yield {
                            "event": "slot_scored",
                            "data": json.dumps(
                                {
                                    "slotId": sr.get("slot_id"),
                                    "score": sr.get("best_score"),
                                    "status": sr.get("status"),
                                },
                                default=str,
                            ),
                        }
                sent_slot_scored_burst = True
            payload = {
                "status": current.status,
                "exif_report": current.exif_report,
                "pixel_report": current.pixel_report,
                "theoretical_grid": current.theoretical_grid,
                "recommendations": [r.model_dump() for r in _recommendation_models(current)],
            }
            yield {"event": "calibration", "data": json.dumps(payload, default=str)}
            if current.status in terminal:
                break
            await asyncio.sleep(1.2)

    return EventSourceResponse(event_generator())


@router.post(
    "/{session_id}/images",
    response_model=CalibrationUploadResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
@limiter.limit(settings.rate_limit_upload)
async def upload_calibration_images(
    request: Request,
    session_id: UUID,
    files: list[UploadFile] = File(..., description="JPEGs (5–30)"),
    consent_process_personal_data: str = Form(
        ...,
        description="Envie 'true' para consentir no processamento dos metadados (LGPD/GDPR).",
    ),
    store_original: bool = Form(
        False,
        description="Se verdadeiro, armazena cópia do JPEG no disco/S3; caso contrário, só EXIF em base.",
    ),
    db: AsyncSession = Depends(get_db),
) -> CalibrationUploadResponse:
    del request
    if str(consent_process_personal_data).lower() not in ("true", "1", "yes", "on"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="É necessário consentimento explícito (consent_process_personal_data=true) para processar os metadados.",
        )

    session = await db.get(CalibrationSession, session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Calibration session not found")

    if session.status == "analyzing":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Análise em andamento; aguarde o término antes de reenviar.",
        )

    n = len(files)
    if n < settings.calibration_min_images or n > settings.calibration_max_images:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Envie entre {settings.calibration_min_images} e {settings.calibration_max_images} imagens JPEG.",
        )

    max_bytes = settings.calibration_max_jpeg_mb * 1024 * 1024

    old_images = (
        await db.scalars(select(CalibrationImage).where(CalibrationImage.session_id == session_id))
    ).all()
    for img in old_images:
        for key in (img.storage_key, img.thumbnail_storage_key, img.small_thumbnail_storage_key):
            if not key or key.startswith("s3://"):
                continue
            p = Path(key)
            if p.is_file():
                p.unlink(missing_ok=True)
    prepared: list[tuple[str, bytes, dict]] = []
    for upload in files:
        raw = await upload.read()
        if len(raw) > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Cada JPEG deve ter no máximo {settings.calibration_max_jpeg_mb} MB.",
            )
        if not raw.startswith(JPEG_MAGIC):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Apenas arquivos JPEG são aceitos nesta fase.",
            )
        fname = _safe_filename(upload.filename)
        exif_payload = extract_calibration_exif(raw)
        prepared.append((fname, raw, exif_payload))

    await db.execute(delete(CalibrationImage).where(CalibrationImage.session_id == session_id))
    session.exif_report = None
    session.pixel_report = None
    await db.flush()

    grid_doc = session.theoretical_grid
    if isinstance(grid_doc, dict):
        reset_slots_to_empty(grid_doc)
        flag_modified(session, "theoretical_grid")

    session_dir = get_calibration_session_dir(session_id)
    accepted = 0
    final_rows: list[tuple[str, int, dict, str | None, str]] = []

    for idx, (fname, raw, exif_payload) in enumerate(prepared):
        storage_key: str | None = None
        if store_original:
            if settings.use_s3:
                local_path = session_dir / fname
                local_path.write_bytes(raw)
                key = f"calibration-sessions/{session_id}/{fname}"
                storage_key = upload_to_storage(local_path, settings.s3_bucket, key)
                local_path.unlink(missing_ok=True)
            else:
                dest = session_dir / fname
                dest.write_bytes(raw)
                storage_key = str(dest.resolve())
        thumb_bytes = build_calibration_thumbnail_jpeg(raw)
        thumb_name = f"thumb_{idx:04d}.jpg"
        small_thumb_bytes = build_calibration_small_thumbnail_jpeg(raw)
        small_thumb_name = f"thumb_small_{idx:04d}.jpg"
        if settings.use_s3:
            tpath = session_dir / thumb_name
            tpath.write_bytes(thumb_bytes)
            tkey = f"calibration-sessions/{session_id}/thumbs/{thumb_name}"
            thumbnail_storage_key = upload_to_storage(tpath, settings.s3_bucket, tkey)
            tpath.unlink(missing_ok=True)
            stpath = session_dir / small_thumb_name
            stpath.write_bytes(small_thumb_bytes)
            stkey = f"calibration-sessions/{session_id}/thumbs/{small_thumb_name}"
            small_thumbnail_storage_key: str = upload_to_storage(stpath, settings.s3_bucket, stkey)
            stpath.unlink(missing_ok=True)
        else:
            tpath = session_dir / thumb_name
            tpath.write_bytes(thumb_bytes)
            thumbnail_storage_key = str(tpath.resolve())
            stpath = session_dir / small_thumb_name
            stpath.write_bytes(small_thumb_bytes)
            small_thumbnail_storage_key = str(stpath.resolve())
        final_rows.append((fname, len(raw), exif_payload, storage_key, thumbnail_storage_key, small_thumbnail_storage_key))
        accepted += 1

    new_images: list[CalibrationImage] = []
    params_d = dict(session.params_snapshot or {})
    for fname, size_b, exif_payload, storage_key, thumbnail_storage_key, small_thumbnail_storage_key in final_rows:
        slot_id, core = assign_image_to_slot(
            _as_float(exif_payload.get("gps_latitude")),
            _as_float(exif_payload.get("gps_longitude")),
            grid_doc if isinstance(grid_doc, dict) else None,
        )
        extras: dict[str, Any] = {}
        if isinstance(grid_doc, dict):
            lat = _as_float(exif_payload.get("gps_latitude"))
            lon = _as_float(exif_payload.get("gps_longitude"))
            fw = float(grid_doc.get("footprint_w_m") or 0.0)
            fh = float(grid_doc.get("footprint_h_m") or 0.0)
            rot = float(params_d.get("rotationDeg") or params_d.get("rotation_deg") or 0.0)
            if lat is not None and lon is not None and fw > 0.0 and fh > 0.0:
                extras["footprint_polygon"] = approx_photo_footprint_polygon(lat, lon, fw, fh, rot)
        img = CalibrationImage(
            session_id=session_id,
            filename=fname,
            storage_key=storage_key,
            thumbnail_storage_key=thumbnail_storage_key,
            small_thumbnail_storage_key=small_thumbnail_storage_key,
            size_bytes=size_b,
            exif=exif_payload,
            primary_slot_id=slot_id,
            is_primary_core=bool(core) if slot_id else None,
            extras=extras,
        )
        new_images.append(img)
        db.add(img)

    if isinstance(grid_doc, dict) and grid_doc.get("slots"):
        assigns = [(str(im.id), im.primary_slot_id) for im in new_images if im.primary_slot_id]
        apply_primary_slots_to_grid(grid_doc, assigns)
        flag_modified(session, "theoretical_grid")

    session.status = "analyzing"
    await db.commit()
    await db.refresh(session)

    analyze_exif_task.delay(str(session_id))

    return CalibrationUploadResponse(
        session_id=session_id,
        accepted=accepted,
        status=session.status,
        store_original=store_original,
        message="Upload aceito; análise EXIF e de píxeis em fila.",
    )
