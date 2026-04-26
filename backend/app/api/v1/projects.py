import asyncio
import json
from datetime import UTC, datetime
from io import BytesIO
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from geoalchemy2.shape import from_shape
from PIL import Image
from shapely.geometry import shape
from sqlalchemy import asc, delete, func, nulls_last, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.storage.file_manager import (
    assemble_chunks,
    cleanup_temp,
    clear_project_image_files,
    clear_project_preview_results_disk,
    clear_project_preview_runs_disk,
    clear_project_processing_runs_disk,
    clear_project_results_disk,
    clear_project_sparse_cloud_disk,
    clear_project_temp,
    delete_calibration_session_storage,
    get_chunk_path,
    get_presigned_url,
    get_project_dir,
    wipe_project_upload_scratch,
)
from app.db.models.calibration_session import CalibrationSession
from app.db.models.project import Project
from app.db.models.project_image import ProjectImage
from app.db.repositories.project_repository import ProjectRepository
from app.dependencies import get_db
from app.services.exif.xmp_parser import DjiXmpParser
from app.schemas.project import (
    ProjectCreate,
    ProjectFlightPlanSave,
    ProjectImageResponse,
    ProjectListItem,
    ProjectPurgeRequest,
    ProjectResponse,
    ProjectUpdate,
)
router = APIRouter(prefix="/projects", tags=["projects"])
project_repository = ProjectRepository()
_dji_xmp_parser = DjiXmpParser()


def _to_float(value) -> float:
    if hasattr(value, "numerator") and hasattr(value, "denominator"):
        return float(value.numerator) / float(value.denominator)
    if isinstance(value, tuple):
        return float(value[0]) / float(value[1])
    return float(value)


def _gps_to_decimal(values, ref: str) -> float:
    degrees = _to_float(values[0])
    minutes = _to_float(values[1])
    seconds = _to_float(values[2])
    decimal = degrees + (minutes / 60.0) + (seconds / 3600.0)
    if ref in {"S", "W"}:
        decimal *= -1
    return decimal


def _parse_exif_datetime_str(value: str | bytes | None) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, bytes):
        value = value.decode("utf-8", errors="replace")
    s = str(value).strip()
    if not s:
        return None
    for fmt in ("%Y:%m:%d %H:%M:%S", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(s, fmt).replace(tzinfo=UTC)
        except ValueError:
            continue
    return None


def _extract_exif_capture_time(file_bytes: bytes) -> datetime | None:
    try:
        image = Image.open(BytesIO(file_bytes))
        exif = image.getexif()
        if not exif:
            return None
        dt_main = exif.get(306)
        if dt_main is not None:
            parsed = _parse_exif_datetime_str(dt_main)
            if parsed:
                return parsed
        try:
            ifd = exif.get_ifd(0x8769)
        except Exception:
            return None
        dt = ifd.get(0x9003) or ifd.get(0x9004)
        return _parse_exif_datetime_str(dt)
    except Exception:
        return None


def _extract_exif_gps(file_bytes: bytes) -> tuple[bool, float | None, float | None]:
    try:
        image = Image.open(BytesIO(file_bytes))
        exif = image.getexif()
        gps_info = exif.get_ifd(34853) if exif else None
        if not gps_info:
            return False, None, None

        lat_values = gps_info.get(2)
        lat_ref = gps_info.get(1)
        lon_values = gps_info.get(4)
        lon_ref = gps_info.get(3)
        if not all([lat_values, lat_ref, lon_values, lon_ref]):
            return False, None, None

        lat_ref_str = lat_ref.decode() if isinstance(lat_ref, bytes) else str(lat_ref)
        lon_ref_str = lon_ref.decode() if isinstance(lon_ref, bytes) else str(lon_ref)
        lat = _gps_to_decimal(lat_values, lat_ref_str)
        lon = _gps_to_decimal(lon_values, lon_ref_str)
        return True, lat, lon
    except Exception:
        return False, None, None


async def _get_flight_area(db: AsyncSession, project_id: UUID) -> dict | None:
    result = await db.execute(
        select(func.ST_AsGeoJSON(Project.flight_area)).where(Project.id == project_id)
    )
    flight_area_geojson = result.scalar_one_or_none()
    if not flight_area_geojson:
        return None
    return json.loads(flight_area_geojson)


async def _serialize_project(db: AsyncSession, project: Project) -> ProjectResponse:
    flight_area = await _get_flight_area(db, project.id)
    return ProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        status=project.status,
        progress=project.progress,
        altitude_m=project.altitude_m,
        forward_overlap=project.forward_overlap,
        side_overlap=project.side_overlap,
        rotation_angle=project.rotation_angle,
        flight_area=flight_area,
        planner_data=project.planner_data,
        stats=project.stats,
        assets=project.assets,
        processing_task_uuid=project.processing_task_uuid,
        odm_task_uuid=project.odm_task_uuid,
        preview_status=project.preview_status,
        preview_progress=project.preview_progress or 0,
        preview_assets=project.preview_assets,
        processing_runs=list(project.processing_runs or []),
        preview_runs=list(project.preview_runs or []),
        last_processing_preset=project.last_processing_preset,
        sparse_cloud_path=project.sparse_cloud_path,
        created_at=project.created_at,
        updated_at=project.updated_at,
        images=[ProjectImageResponse.model_validate(image) for image in project.images],
    )


def _resolve_asset_path(project_id: UUID, asset_value: str) -> Path:
    project_dir = get_project_dir(project_id).resolve()
    asset_path = Path(asset_value).expanduser()
    if not asset_path.is_absolute():
        asset_path = project_dir / asset_path
    resolved = asset_path.resolve()
    try:
        resolved.relative_to(project_dir)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Asset path is outside project directory",
        ) from exc
    return resolved


@router.get("", response_model=list[ProjectListItem])
async def list_projects(db: AsyncSession = Depends(get_db)) -> list[ProjectListItem]:
    projects = await project_repository.list_all(db)
    return [ProjectListItem.model_validate(project) for project in projects]


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(body: ProjectCreate, db: AsyncSession = Depends(get_db)) -> ProjectResponse:
    project = await project_repository.create(
        db,
        name=body.name,
        description=body.description,
    )
    project = await project_repository.get_with_images(db, project.id)
    if not project:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Project reload failed")
    return await _serialize_project(db, project)


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: UUID, db: AsyncSession = Depends(get_db)) -> ProjectResponse:
    project = await project_repository.get_with_images(db, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return await _serialize_project(db, project)


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID, body: ProjectUpdate, db: AsyncSession = Depends(get_db)
) -> ProjectResponse:
    project = await project_repository.get(db, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    update_data = body.model_dump(exclude_unset=True)
    flight_area = update_data.pop("flight_area", None)
    if flight_area:
        update_data["flight_area"] = from_shape(shape(flight_area), srid=4326)

    project = await project_repository.update(db, project, **update_data)
    project = await project_repository.get_with_images(db, project.id)
    if not project:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Project reload failed")
    return await _serialize_project(db, project)


def _project_purge_blocked(project: Project) -> bool:
    if project.status in {"processing", "queued"}:
        return True
    preview_st = (project.preview_status or "").lower()
    if preview_st in {"processing", "queued"}:
        return True
    return False


@router.post("/{project_id}/purge", response_model=ProjectResponse)
async def purge_project_data(
    project_id: UUID,
    body: ProjectPurgeRequest,
    db: AsyncSession = Depends(get_db),
) -> ProjectResponse:
    """
    Remove selected project data from storage and database.
    Cannot run while main or preview pipeline is active.
    """
    project = await project_repository.get_with_images(db, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if _project_purge_blocked(project):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot purge while processing or preview is running",
        )

    if body.calibration_sessions:
        session_ids = (
            await db.execute(select(CalibrationSession.id).where(CalibrationSession.project_id == project_id))
        ).scalars().all()
        for sid in session_ids:
            delete_calibration_session_storage(sid)
        await db.execute(delete(CalibrationSession).where(CalibrationSession.project_id == project_id))

    if body.images:
        clear_project_temp(project_id)
        clear_project_image_files(project_id)
        await db.execute(delete(ProjectImage).where(ProjectImage.project_id == project_id))
        project.progress = 0
        project.processing_task_uuid = None
        project.odm_task_uuid = None
        project.status = "draft"

    if body.flight_plan:
        project.flight_area = None
        project.planner_data = None
        project.altitude_m = None
        project.forward_overlap = None
        project.side_overlap = None
        project.rotation_angle = None

    if body.processing_results:
        clear_project_results_disk(project_id)
        project.assets = None
        project.stats = None
        project.processing_task_uuid = None
        project.odm_task_uuid = None
        project.last_processing_preset = None
        project.sparse_cloud_path = None
        clear_project_sparse_cloud_disk(project_id)
        project.status = "draft"
        project.progress = 0

    if body.preview_results:
        clear_project_preview_results_disk(project_id)
        project.preview_assets = None
        project.preview_status = None
        project.preview_progress = 0
        project.preview_task_uuid = None
        project.preview_odm_task_uuid = None
        project.sparse_cloud_path = None
        clear_project_sparse_cloud_disk(project_id)

    if body.processing_runs:
        clear_project_processing_runs_disk(project_id)
        project.processing_runs = []

    if body.preview_runs:
        clear_project_preview_runs_disk(project_id)
        project.preview_runs = []

    await db.commit()
    project = await project_repository.get_with_images(db, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Project reload failed")
    return await _serialize_project(db, project)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(project_id: UUID, db: AsyncSession = Depends(get_db)) -> None:
    project = await project_repository.get(db, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    await project_repository.delete(db, project)


@router.post("/{project_id}/flightplan", response_model=ProjectResponse)
async def save_project_flightplan(
    project_id: UUID, body: ProjectFlightPlanSave, db: AsyncSession = Depends(get_db)
) -> ProjectResponse:
    project = await project_repository.get(db, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    update_data = body.model_dump(exclude_unset=True)
    flight_area = update_data.pop("flight_area", None)
    if flight_area:
        update_data["flight_area"] = from_shape(shape(flight_area), srid=4326)

    project = await project_repository.update(db, project, **update_data)
    project = await project_repository.get_with_images(db, project.id)
    if not project:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Project reload failed")
    return await _serialize_project(db, project)


@router.get("/{project_id}/flight-path")
async def get_project_flight_path(project_id: UUID, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """
    GeoJSON FeatureCollection: LineString [lng, lat, relative_altitude] plus Point per photo.
    Ordered by EXIF capture time when available. Requires at least 3 geotagged images.
    """
    project = await project_repository.get(db, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    result = await db.execute(
        select(ProjectImage)
        .where(
            ProjectImage.project_id == project_id,
            ProjectImage.lat.isnot(None),
            ProjectImage.lon.isnot(None),
        )
        .order_by(nulls_last(asc(ProjectImage.captured_at)), asc(ProjectImage.created_at))
    )
    images = list(result.scalars().all())
    if len(images) < 3:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Menos de 3 imagens com GPS; nao e possivel reconstruir o trajeto.",
        )

    def rel_z(img: ProjectImage) -> float:
        return float(img.relative_altitude) if img.relative_altitude is not None else 0.0

    line_coords: list[list[float]] = [[img.lon, img.lat, rel_z(img)] for img in images]
    line_feature: dict[str, Any] = {
        "type": "Feature",
        "geometry": {"type": "LineString", "coordinates": line_coords},
        "properties": {"kind": "reconstructed_route"},
    }
    point_features: list[dict[str, Any]] = []
    for img in images:
        point_features.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [img.lon, img.lat, rel_z(img)],
                },
                "properties": {
                    "filename": img.filename,
                    "gimbal_pitch": img.gimbal_pitch,
                    "flight_yaw": img.flight_yaw,
                    "captured_at": img.captured_at.isoformat() if img.captured_at else None,
                },
            }
        )

    return {"type": "FeatureCollection", "features": [line_feature, *point_features]}


@router.post("/{project_id}/images/upload-chunk")
async def upload_chunk(
    project_id: UUID,
    file_id: str = Form(...),
    chunk_index: int = Form(..., ge=0),
    total_chunks: int = Form(..., ge=1),
    filename: str = Form(...),
    chunk: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> ProjectImageResponse | dict[str, str | bool]:
    project = await project_repository.get(db, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    chunk_path = get_chunk_path(project_id, file_id, chunk_index)
    chunk_bytes = await chunk.read()
    max_upload_bytes = settings.max_upload_file_size_mb * 1024 * 1024
    if len(chunk_bytes) > max_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Chunk exceeds max file size of {settings.max_upload_file_size_mb} MB",
        )
    chunk_path.write_bytes(chunk_bytes)

    if chunk_index < total_chunks - 1:
        return {
            "complete": False,
            "message": f"Chunk {chunk_index + 1}/{total_chunks} uploaded",
        }

    temp_dir = get_project_dir(project_id) / "temp" / file_id
    images_dir = get_project_dir(project_id) / "images"
    # Evita colisão: se já existe arquivo com mesmo nome, adiciona sufixo único
    stem = Path(filename).stem
    suffix = Path(filename).suffix
    final_filename = filename
    if (images_dir / filename).exists():
        final_filename = f"{stem}_{uuid4().hex[:8]}{suffix}"
    output_path = images_dir / final_filename
    assemble_chunks(temp_dir, output_path, total_chunks)
    max_upload_bytes = settings.max_upload_file_size_mb * 1024 * 1024
    if output_path.stat().st_size > max_upload_bytes:
        output_path.unlink(missing_ok=True)
        cleanup_temp(project_id, file_id)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds max size of {settings.max_upload_file_size_mb} MB",
        )

    file_bytes = output_path.read_bytes()
    has_gps, lat, lon = _extract_exif_gps(file_bytes)
    xmp = _dji_xmp_parser.parse_bytes(file_bytes)
    captured_at = _extract_exif_capture_time(file_bytes)
    image = ProjectImage(
        project_id=project_id,
        filename=final_filename,
        has_gps=has_gps,
        lat=lat,
        lon=lon,
        relative_altitude=xmp.relative_altitude if xmp else None,
        gimbal_pitch=xmp.gimbal_pitch if xmp else None,
        flight_yaw=xmp.flight_yaw if xmp else None,
        captured_at=captured_at,
    )
    db.add(image)
    await db.commit()
    await db.refresh(image)
    cleanup_temp(project_id, file_id)

    return ProjectImageResponse.model_validate(image)


@router.get("/{project_id}/assets/{asset_key:path}/download")
async def download_project_asset(
    project_id: UUID,
    asset_key: str,
    db: AsyncSession = Depends(get_db),
):
    project = await project_repository.get(db, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if project.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Assets are available only when project is completed",
        )
    if not project.assets:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No assets available")

    asset_value = project.assets.get(asset_key)
    if not asset_value or not isinstance(asset_value, str):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")

    if asset_value.startswith("s3://"):
        if not settings.use_s3:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Asset stored on S3 but S3 integration is disabled",
            )
        bucket_and_key = asset_value.removeprefix("s3://")
        bucket, _, key = bucket_and_key.partition("/")
        if not bucket or not key:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid S3 asset path")
        return RedirectResponse(url=get_presigned_url(bucket, key, expires_in=3600))

    asset_path = _resolve_asset_path(project_id, asset_value)
    if not asset_path.exists() or not asset_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset file not found")
    return FileResponse(path=asset_path, filename=asset_path.name, media_type="application/octet-stream")


@router.get("/{project_id}/images", response_model=list[ProjectImageResponse])
async def list_project_images(
    project_id: UUID, db: AsyncSession = Depends(get_db)
) -> list[ProjectImageResponse]:
    project = await project_repository.get(db, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    result = await db.execute(
        select(ProjectImage)
        .where(ProjectImage.project_id == project_id)
        .order_by(ProjectImage.created_at.desc())
    )
    images = result.scalars().all()
    return [ProjectImageResponse.model_validate(image) for image in images]


@router.delete("/{project_id}/images/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project_image(
    project_id: UUID, image_id: UUID, db: AsyncSession = Depends(get_db)
) -> None:
    project = await project_repository.get(db, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    result = await db.execute(
        select(ProjectImage).where(ProjectImage.id == image_id, ProjectImage.project_id == project_id)
    )
    image = result.scalar_one_or_none()
    if not image:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")

    image_path = get_project_dir(project_id) / "images" / image.filename
    image_path.unlink(missing_ok=True)
    await db.delete(image)
    await db.commit()


@router.post("/{project_id}/images/reset-upload-session", status_code=status.HTTP_200_OK)
async def reset_upload_session(
    project_id: UUID, db: AsyncSession = Depends(get_db)
) -> dict[str, int]:
    """Remove temp chunks, image files on disk, and all project_images rows. Resets project to draft when idle."""
    project = await project_repository.get(db, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if project.status in {"processing", "queued"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot reset upload while project is processing",
        )

    wipe_project_upload_scratch(project_id)

    result = await db.execute(delete(ProjectImage).where(ProjectImage.project_id == project_id))
    deleted = int(result.rowcount or 0)

    project.progress = 0
    project.processing_task_uuid = None
    project.odm_task_uuid = None
    project.status = "draft"
    project.preview_status = None
    project.preview_progress = 0
    project.preview_task_uuid = None
    project.preview_odm_task_uuid = None
    project.preview_assets = None
    project.sparse_cloud_path = None

    await db.commit()
    return {"deleted_images": deleted}


@router.get("/{project_id}/sparse-cloud", response_model=None)
async def get_sparse_cloud(
    project_id: UUID,
    max_points: int | None = Query(
        default=None,
        description="Amostragem: limita features (100–50_000) para leves GPUs / PointCloud 3D (O.10).",
    ),
    db: AsyncSession = Depends(get_db),
) -> FileResponse | JSONResponse:
    """
    Return the sparse point cloud (GeoJSON) generated by SfM.
    Available after ~15-20% of processing progress.
    """
    project = await project_repository.get(db, project_id)
    if not project or not project.sparse_cloud_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sparse cloud not available yet")

    sparse_path = Path(project.sparse_cloud_path)
    project_dir = get_project_dir(project_id).resolve()
    if not sparse_path.resolve().is_relative_to(project_dir):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid path")

    if not sparse_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sparse cloud file not found")

    if max_points is not None and (max_points < 100 or max_points > 50_000):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="max_points must be between 100 and 50_000",
        )

    if max_points is None:
        return FileResponse(sparse_path, media_type="application/json")

    text: str = await asyncio.to_thread(lambda: sparse_path.read_text(encoding="utf-8"))
    data = json.loads(text)
    feats = data.get("features")
    if not isinstance(feats, list):
        return JSONResponse(content=data)
    n = len(feats)
    if n <= max_points:
        return JSONResponse(content=data)
    step = max(1, (n + max_points - 1) // max_points)
    sampled = feats[::step]
    if len(sampled) > max_points:
        sampled = sampled[:max_points]
    return JSONResponse(content={**data, "features": sampled})


@router.get("/{project_id}/bounds")
async def get_project_bounds(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Return the WGS84 bounding box for the project area.
    Priority: orthophoto COG bounds > image GPS (EXIF) > flight_area polygon.
    Returns {west, south, east, north} or 404 if no spatial data available.
    """
    project = await project_repository.get(db, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    # 1. Try full or preview orthophoto COG
    def _cog_bounds(assets: dict | None) -> dict | None:
        if not assets:
            return None
        for key, path_str in assets.items():
            if "odm_orthophoto.tif" in key.lower():
                p = Path(path_str)
                if not p.exists():
                    return None
                try:
                    import rasterio
                    from rasterio.crs import CRS
                    from rasterio.warp import transform_bounds

                    with rasterio.open(p) as src:
                        west, south, east, north = transform_bounds(
                            src.crs, CRS.from_epsg(4326), *src.bounds
                        )
                    return {"west": west, "south": south, "east": east, "north": north}
                except Exception:
                    return None
        return None

    bounds = _cog_bounds(project.assets) or _cog_bounds(project.preview_assets)
    if bounds:
        return bounds

    # 2. Image GPS bounding box — ground truth: where the images actually are
    result = await db.execute(
        select(ProjectImage.lat, ProjectImage.lon).where(
            ProjectImage.project_id == project_id,
            ProjectImage.lat.isnot(None),
            ProjectImage.lon.isnot(None),
        )
    )
    rows = result.all()
    if rows:
        lats = [r.lat for r in rows]
        lons = [r.lon for r in rows]
        return {
            "west": min(lons),
            "south": min(lats),
            "east": max(lons),
            "north": max(lats),
        }

    # 3. Fallback: flight_area polygon bounding box (planned area, may differ from actual images)
    if project.flight_area is not None:
        try:
            flight_area_result = await db.execute(
                select(func.ST_AsGeoJSON(Project.flight_area)).where(Project.id == project_id)
            )
            flight_area_geojson = flight_area_result.scalar_one_or_none()
            if flight_area_geojson:
                geom = json.loads(flight_area_geojson)
                coords = geom.get("coordinates", [[]])[0]
                if coords:
                    lons = [c[0] for c in coords]
                    lats = [c[1] for c in coords]
                    return {
                        "west": min(lons),
                        "south": min(lats),
                        "east": max(lons),
                        "north": max(lats),
                    }
        except Exception:
            pass

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No spatial data available")
