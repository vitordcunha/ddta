import json
from io import BytesIO
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse, RedirectResponse
from geoalchemy2.shape import from_shape
from PIL import Image
from shapely.geometry import shape
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.storage.file_manager import (
    assemble_chunks,
    cleanup_temp,
    get_chunk_path,
    get_presigned_url,
    get_project_dir,
)
from app.db.models.project import Project
from app.db.models.project_image import ProjectImage
from app.db.repositories.project_repository import ProjectRepository
from app.dependencies import get_db
from app.schemas.project import (
    ProjectCreate,
    ProjectFlightPlanSave,
    ProjectImageResponse,
    ProjectListItem,
    ProjectResponse,
    ProjectUpdate,
)
from app.utils.rate_limit import limiter

router = APIRouter(prefix="/projects", tags=["projects"])
project_repository = ProjectRepository()


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
        stats=project.stats,
        assets=project.assets,
        processing_task_uuid=project.processing_task_uuid,
        odm_task_uuid=project.odm_task_uuid,
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


@router.post("/{project_id}/images/upload-chunk")
@limiter.limit(settings.rate_limit_upload)
async def upload_chunk(
    request: Request,
    project_id: UUID,
    file_id: str = Form(...),
    chunk_index: int = Form(..., ge=0),
    total_chunks: int = Form(..., ge=1),
    filename: str = Form(...),
    chunk: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> ProjectImageResponse | dict[str, str | bool]:
    del request
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
    output_path = images_dir / filename
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
    image = ProjectImage(project_id=project_id, filename=filename, has_gps=has_gps, lat=lat, lon=lon)
    db.add(image)
    await db.commit()
    await db.refresh(image)
    cleanup_temp(project_id, file_id)

    return ProjectImageResponse.model_validate(image)


@router.get("/{project_id}/assets/{asset_key}/download")
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
