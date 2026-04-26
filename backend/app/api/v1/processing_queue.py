from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.processing.odm_client import ODMClient
from app.db.models.project import Project
from app.dependencies import get_db
from app.schemas.processing_queue import (
    CeleryRevokeRequest,
    OdmCancelRequest,
    ProcessingMonitorResponse,
)
from app.services.processing_monitor import build_processing_monitor
from app.tasks.celery_app import celery_app
from app.utils.rate_limit import limiter

router = APIRouter(prefix="/processing-queue", tags=["processing-queue"])


def _cancel_odm_safe(task_uuid: str) -> None:
    if not task_uuid:
        return
    try:
        ODMClient(settings.odm_node_host, settings.odm_node_port).cancel_task(task_uuid)
    except Exception:
        pass


@router.get("", response_model=ProcessingMonitorResponse)
async def get_processing_monitor(db: AsyncSession = Depends(get_db)) -> ProcessingMonitorResponse:
    """Celery (fila + activos), fila NodeODM, e projetos com pipeline principal ou preview em curso."""
    return await build_processing_monitor(db)


@router.post("/celery/revoke", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit(settings.rate_limit_processing)
async def revoke_celery_task(
    request: Request,
    body: CeleryRevokeRequest,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Revoga uma tarefa Celery (terminate) e, se estiver ligada a um projecto, cancela ODM associado e limpa a base."""
    del request
    task_id = body.task_id.strip()
    if not task_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="task_id is required")

    result = await db.execute(
        select(Project).where(
            or_(
                Project.processing_task_uuid == task_id,
                Project.preview_task_uuid == task_id,
            )
        )
    )
    projects = list(result.scalars().all())
    for project in projects:
        if project.processing_task_uuid == task_id and project.odm_task_uuid:
            _cancel_odm_safe(project.odm_task_uuid)
        if project.preview_task_uuid == task_id and project.preview_odm_task_uuid:
            _cancel_odm_safe(project.preview_odm_task_uuid)

    celery_app.control.revoke(task_id, terminate=True)

    for project in projects:
        if project.processing_task_uuid == task_id:
            project.processing_task_uuid = None
            project.odm_task_uuid = None
            if project.status in {"queued", "processing"}:
                project.status = "cancelled"
                project.progress = 0
        if project.preview_task_uuid == task_id:
            project.preview_task_uuid = None
            project.preview_odm_task_uuid = None
            project.preview_status = None
            project.preview_progress = 0

    if projects:
        await db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/odm/cancel", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit(settings.rate_limit_processing)
async def cancel_odm_task(
    request: Request,
    body: OdmCancelRequest,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Cancela uma tarefa no NodeODM e revoga Celery / limpa campos do projecto correspondente."""
    del request
    uuid_str = body.task_uuid.strip()
    if not uuid_str:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="task_uuid is required")

    try:
        ODMClient(settings.odm_node_host, settings.odm_node_port).cancel_task(uuid_str)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"NodeODM cancel failed: {exc}",
        ) from exc

    result = await db.execute(
        select(Project).where(
            or_(
                Project.odm_task_uuid == uuid_str,
                Project.preview_odm_task_uuid == uuid_str,
            )
        )
    )
    projects = list(result.scalars().all())
    for project in projects:
        if project.odm_task_uuid == uuid_str:
            if project.processing_task_uuid:
                celery_app.control.revoke(project.processing_task_uuid, terminate=True)
            project.odm_task_uuid = None
            project.processing_task_uuid = None
            if project.status in {"queued", "processing"}:
                project.status = "cancelled"
                project.progress = 0
        if project.preview_odm_task_uuid == uuid_str:
            if project.preview_task_uuid:
                celery_app.control.revoke(project.preview_task_uuid, terminate=True)
            project.preview_odm_task_uuid = None
            project.preview_task_uuid = None
            project.preview_status = None
            project.preview_progress = 0

    if projects:
        await db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)
