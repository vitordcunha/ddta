import asyncio
import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

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
            result = await db.execute(select(Project).where(Project.id == project_id))
            current = result.scalar_one_or_none()
            if not current:
                break
            payload = {
                "status": current.status,
                "progress": current.progress,
                "assets": current.assets,
                "task_uuid": current.processing_task_uuid,
            }
            yield {
                "event": "status",
                "data": json.dumps(payload),
            }
            if current.status in terminal_states:
                break
            await asyncio.sleep(3)

    return EventSourceResponse(event_generator())
