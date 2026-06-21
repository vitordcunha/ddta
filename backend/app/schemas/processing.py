from pydantic import BaseModel, Field


class ProcessRequest(BaseModel):
    preset: str = Field(default="standard")
    options: dict = Field(default_factory=dict)
    enable_preview: bool = Field(default=False)
    selective: bool = Field(default=False)


class BoundaryRequest(BaseModel):
    boundary: dict = Field(..., description="GeoJSON Polygon or Feature containing the boundary")


class ProcessingStatus(BaseModel):
    project_id: str
    status: str
    progress: int
    assets: dict | None = None
    task_uuid: str | None = None
    preview_status: str | None = None
    preview_progress: int | None = None
