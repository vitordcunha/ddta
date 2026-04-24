from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.processing.odm_client import ODMClient
from app.core.processing.presets import get_odm_options
from app.core.storage.file_manager import get_project_dir
from app.db.models.project import Project
from app.db.models.project_image import ProjectImage
from app.dependencies import get_db
from app.schemas.processing import ProcessRequest, ProcessingStatus
from app.tasks.celery_app import celery_app
from app.tasks.processing_tasks import process_images_task
from app.utils.rate_limit import limiter

router = APIRouter(tags=["processing"])


@router.post("/projects/{project_id}/process", response_model=ProcessingStatus, status_code=status.HTTP_202_ACCEPTED)
@limiter.limit(settings.rate_limit_processing)
async def process_project(
    request: Request,
    project_id: UUID,
    body: ProcessRequest,
    db: AsyncSession = Depends(get_db),
) -> ProcessingStatus:
    del request
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if project.status == "processing":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Project is already processing")
    if project.status not in {"draft", "failed", "completed", "canceled", "cancelled"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Project is not in a valid state")

    images_result = await db.execute(
        select(ProjectImage).where(ProjectImage.project_id == project_id).order_by(ProjectImage.created_at.asc())
    )
    images = list(images_result.scalars().all())
    if not images:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Project has no images")

    image_paths = [str(get_project_dir(project_id) / "images" / image.filename) for image in images]
    missing_paths = [path for path in image_paths if not Path(path).exists()]
    if missing_paths:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{len(missing_paths)} image files are missing from storage",
        )

    try:
        options = get_odm_options(body.preset, body.options)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    task = process_images_task.delay(str(project_id), image_paths, options)
    project.status = "queued"
    project.progress = 0
    project.processing_task_uuid = task.id
    project.odm_task_uuid = None
    await db.commit()

    return ProcessingStatus(
        project_id=str(project.id),
        status=project.status,
        progress=project.progress,
        assets=project.assets,
        task_uuid=task.id,
    )


@router.delete("/projects/{project_id}/process", response_model=ProcessingStatus)
@limiter.limit(settings.rate_limit_processing)
async def cancel_processing(
    request: Request, project_id: UUID, db: AsyncSession = Depends(get_db)
) -> ProcessingStatus:
    del request
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if project.status not in {"queued", "processing"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Project is not processing")

    if project.processing_task_uuid:
        celery_app.control.revoke(project.processing_task_uuid, terminate=True)
    if project.odm_task_uuid:
        try:
            ODMClient(settings.odm_node_host, settings.odm_node_port).cancel_task(project.odm_task_uuid)
        except Exception:
            pass

    project.status = "cancelled"
    project.progress = 0
    project.processing_task_uuid = None
    project.odm_task_uuid = None
    await db.commit()

    return ProcessingStatus(
        project_id=str(project.id),
        status=project.status,
        progress=project.progress,
        assets=project.assets,
        task_uuid=None,
    )
