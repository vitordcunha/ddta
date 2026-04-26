from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.processing.odm_client import ODMClient
from app.core.processing.presets import get_odm_options
from app.core.storage.file_manager import (
    archive_project_preview_run,
    archive_project_processing_run,
    get_project_dir,
)
from app.db.models.project import Project
from app.db.models.project_image import ProjectImage
from app.dependencies import get_db
from app.schemas.processing import ProcessRequest, ProcessingStatus
from app.tasks.celery_app import celery_app
from app.tasks.processing_tasks import (
    finalize_main_processing_task,
    finalize_preview_processing_task,
    main_orthophoto_path,
    preview_orthophoto_path,
    process_images_task,
    process_preview_task,
)
from app.utils.rate_limit import limiter

router = APIRouter(tags=["processing"])


def _processing_status(project: Project) -> ProcessingStatus:
    return ProcessingStatus(
        project_id=str(project.id),
        status=project.status,
        progress=project.progress,
        assets=project.assets,
        task_uuid=project.processing_task_uuid,
        preview_status=project.preview_status,
        preview_progress=project.preview_progress,
    )


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

    if project.status == "completed" and project.assets:
        archived = archive_project_processing_run(
            project_id,
            project.last_processing_preset or "desconhecido",
            project.stats,
            project.assets,
        )
        if archived:
            project.processing_runs = [*list(project.processing_runs or []), archived]

    if (
        body.enable_preview
        and project.preview_assets
        and project.preview_status == "completed"
    ):
        prev_archived = archive_project_preview_run(project_id, project.preview_assets)
        if prev_archived:
            project.preview_runs = [*list(project.preview_runs or []), prev_archived]

    project.last_processing_preset = body.preset

    task = process_images_task.delay(str(project_id), image_paths, options)
    project.status = "queued"
    project.progress = 0
    project.processing_task_uuid = task.id
    project.odm_task_uuid = None

    if body.enable_preview:
        preview_task = process_preview_task.delay(str(project_id), image_paths)
        project.preview_status = "queued"
        project.preview_progress = 0
        project.preview_task_uuid = preview_task.id
        project.preview_odm_task_uuid = None
        project.preview_assets = None

    await db.commit()
    await db.refresh(project)

    return _processing_status(project)


@router.post(
    "/projects/{project_id}/finalize",
    response_model=ProcessingStatus,
    status_code=status.HTTP_202_ACCEPTED,
)
@limiter.limit(settings.rate_limit_processing)
async def finalize_main_processing(
    request: Request,
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> ProcessingStatus:
    """Retoma COG + organize_results quando o processamento ficou preso após o ODM (ex. crash do worker)."""
    del request
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    if project.status == "completed" and project.assets:
        return _processing_status(project)

    ortho = main_orthophoto_path(project_id)
    if not ortho.exists():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Orthophoto not found in storage; finalization is only possible after ODM output is present",
        )

    if project.status not in {"processing", "failed"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Project must be in processing or failed state to finalize main results",
        )

    task = finalize_main_processing_task.delay(str(project_id))
    project.processing_task_uuid = task.id
    await db.commit()
    await db.refresh(project)
    return _processing_status(project)


@router.post(
    "/projects/{project_id}/finalize-preview",
    response_model=ProcessingStatus,
    status_code=status.HTTP_202_ACCEPTED,
)
@limiter.limit(settings.rate_limit_processing)
async def finalize_preview_processing(
    request: Request,
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> ProcessingStatus:
    del request
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    if project.preview_status == "completed" and project.preview_assets:
        return _processing_status(project)

    ortho = preview_orthophoto_path(project_id)
    if not ortho.exists():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Preview orthophoto not found; run preview processing first",
        )

    if project.preview_status not in {"processing", "failed"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Preview must be in processing or failed state to finalize",
        )

    task = finalize_preview_processing_task.delay(str(project_id))
    project.preview_task_uuid = task.id
    await db.commit()
    await db.refresh(project)
    return _processing_status(project)


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

    if project.preview_task_uuid:
        celery_app.control.revoke(project.preview_task_uuid, terminate=True)
    if project.preview_odm_task_uuid:
        try:
            ODMClient(settings.odm_node_host, settings.odm_node_port).cancel_task(project.preview_odm_task_uuid)
        except Exception:
            pass

    project.status = "cancelled"
    project.progress = 0
    project.processing_task_uuid = None
    project.odm_task_uuid = None
    project.preview_status = None
    project.preview_progress = 0
    project.preview_task_uuid = None
    project.preview_odm_task_uuid = None
    await db.commit()
    await db.refresh(project)

    return _processing_status(project)
