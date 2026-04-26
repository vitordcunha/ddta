from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, computed_field, model_validator


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str = Field("", max_length=1000)


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=1000)
    flight_area: dict | None = None
    planner_data: dict | None = None
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
    planner_data: dict | None = None


class ProjectImageResponse(BaseModel):
    id: UUID
    project_id: UUID
    filename: str
    has_gps: bool
    lat: float | None
    lon: float | None
    relative_altitude: float | None = None
    gimbal_pitch: float | None = None
    flight_yaw: float | None = None
    captured_at: datetime | None = None
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
    planner_data: dict | None = None
    stats: dict | None
    assets: dict | None
    processing_task_uuid: str | None = None
    odm_task_uuid: str | None = None
    preview_status: str | None = None
    preview_progress: int = 0
    preview_assets: dict | None = None
    processing_runs: list[dict] = Field(default_factory=list)
    preview_runs: list[dict] = Field(default_factory=list)
    last_processing_preset: str | None = None
    sparse_cloud_path: str | None = Field(default=None, exclude=True)
    created_at: datetime
    updated_at: datetime
    images: list[ProjectImageResponse] = []

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    @property
    def sparse_cloud_available(self) -> bool:
        return self.sparse_cloud_path is not None


class ProjectListItem(BaseModel):
    id: UUID
    name: str
    description: str
    status: str
    progress: int
    planner_data: dict | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProjectPurgeRequest(BaseModel):
    """Select which project data to remove from disk and database."""

    images: bool = False
    flight_plan: bool = False
    processing_results: bool = False
    preview_results: bool = False
    processing_runs: bool = False
    preview_runs: bool = False
    calibration_sessions: bool = False

    @model_validator(mode="after")
    def require_at_least_one_flag(self) -> "ProjectPurgeRequest":
        if not any(
            [
                self.images,
                self.flight_plan,
                self.processing_results,
                self.preview_results,
                self.processing_runs,
                self.preview_runs,
                self.calibration_sessions,
            ]
        ):
            raise ValueError("Select at least one purge option")
        return self
