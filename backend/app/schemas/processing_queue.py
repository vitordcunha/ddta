from datetime import datetime

from pydantic import BaseModel, Field


class CeleryTaskItem(BaseModel):
    worker: str
    bucket: str = Field(description="active, reserved, or scheduled")
    task_id: str | None = None
    task_name: str | None = None
    args_preview: str | None = None


class OdmTaskItem(BaseModel):
    uuid: str
    status: str
    progress: float = 0.0
    linked_project_id: str | None = None
    pipeline: str | None = Field(default=None, description="main, preview, or None if unknown")


class ProjectPipelineItem(BaseModel):
    id: str
    name: str
    status: str
    progress: int
    preview_status: str | None = None
    preview_progress: int = 0
    celery_main_task_id: str | None = None
    celery_preview_task_id: str | None = None
    odm_main_task_id: str | None = None
    odm_preview_task_id: str | None = None


class CeleryRevokeRequest(BaseModel):
    task_id: str = Field(..., min_length=6, max_length=128)


class OdmCancelRequest(BaseModel):
    task_uuid: str = Field(..., min_length=6, max_length=128)


class ProcessingMonitorResponse(BaseModel):
    generated_at: datetime
    celery_workers_reached: bool
    celery_error: str | None = None
    celery_tasks: list[CeleryTaskItem] = Field(default_factory=list)
    odm_node_reachable: bool
    odm_error: str | None = None
    odm_host: str
    odm_port: int
    odm_tasks: list[OdmTaskItem] = Field(default_factory=list)
    pipeline_projects: list[ProjectPipelineItem] = Field(default_factory=list)
