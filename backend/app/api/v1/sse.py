import asyncio
import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.core.processing.sparse_cloud_track import sparse_cloud_track_payload
from app.db.models.project import Project
from app.dependencies import get_db

router = APIRouter(tags=["sse"])


@router.get("/projects/{project_id}/status/stream")
async def stream_project_status(project_id: UUID, db: AsyncSession = Depends(get_db)) -> EventSourceResponse:
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    async def event_generator():
        terminal_states = {"completed", "failed", "canceled", "cancelled"}
        while True:
            # Sem populate_existing, a mesma instância na sessão pode manter progress/status
            # antigos apesar de commits do Celery — a UI recebe SSE mas o valor nunca muda.
            stmt = (
                select(Project)
                .where(Project.id == project_id)
                .execution_options(populate_existing=True)
            )
            result = await db.execute(stmt)
            current = result.scalar_one_or_none()
            if not current:
                break
            sparse_available = current.sparse_cloud_path is not None
            track = sparse_cloud_track_payload(
                int(current.progress or 0),
                str(current.status or ""),
                sparse_available,
            )
            payload = {
                "status": current.status,
                "progress": current.progress,
                "assets": current.assets,
                "task_uuid": current.processing_task_uuid,
                "preview_status": current.preview_status,
                "preview_progress": current.preview_progress,
                "preview_assets": current.preview_assets,
                "processing_runs": list(current.processing_runs or []),
                "preview_runs": list(current.preview_runs or []),
                "last_processing_preset": current.last_processing_preset,
                "sparse_cloud_available": sparse_available,
                "sparse_cloud_track_progress": track["sparse_cloud_track_progress"],
                "sparse_cloud_track_hint": track["sparse_cloud_track_hint"],
            }
            yield {
                "event": "status",
                "data": json.dumps(payload),
            }
            if current.status in terminal_states:
                break
            await asyncio.sleep(3)

    return EventSourceResponse(event_generator())
