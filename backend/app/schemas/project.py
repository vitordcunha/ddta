from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str = Field("", max_length=1000)


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=1000)
    flight_area: dict | None = None
    altitude_m: float | None = Field(default=None, gt=0)
    forward_overlap: int | None = Field(default=None, ge=0, le=99)
    side_overlap: int | None = Field(default=None, ge=0, le=99)
    rotation_angle: float | None = None


class ProjectFlightPlanSave(BaseModel):
    flight_area: dict | None = None
    altitude_m: float | None = Field(default=None, gt=0)
    forward_overlap: int | None = Field(default=None, ge=0, le=99)
    side_overlap: int | None = Field(default=None, ge=0, le=99)
    rotation_angle: float | None = None
    stats: dict | None = None


class ProjectImageResponse(BaseModel):
    id: UUID
    project_id: UUID
    filename: str
    has_gps: bool
    lat: float | None
    lon: float | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProjectResponse(BaseModel):
    id: UUID
    name: str
    description: str
    status: str
    progress: int
    altitude_m: float | None
    forward_overlap: int | None
    side_overlap: int | None
    rotation_angle: float | None
    flight_area: dict | None = None
    stats: dict | None
    assets: dict | None
    processing_task_uuid: str | None = None
    odm_task_uuid: str | None = None
    created_at: datetime
    updated_at: datetime
    images: list[ProjectImageResponse] = []

    model_config = ConfigDict(from_attributes=True)


class ProjectListItem(BaseModel):
    id: UUID
    name: str
    description: str
    status: str
    progress: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
