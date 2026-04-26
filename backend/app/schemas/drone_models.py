from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class DroneModelRead(BaseModel):
    id: UUID
    name: str
    manufacturer: str
    is_default: bool
    is_custom: bool
    sensor_width_mm: float
    sensor_height_mm: float
    focal_length_mm: float
    image_width_px: int
    image_height_px: int
    fov_horizontal_deg: float
    fov_vertical_deg: float
    gimbal_pitch_min: float
    gimbal_pitch_max: float
    max_speed_ms: float
    max_altitude_m: float
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DroneModelCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=256)
    manufacturer: str = Field(..., min_length=1, max_length=128)
    sensor_width_mm: float = Field(..., gt=0)
    sensor_height_mm: float = Field(..., gt=0)
    focal_length_mm: float = Field(..., gt=0)
    image_width_px: int = Field(..., gt=0)
    image_height_px: int = Field(..., gt=0)
    gimbal_pitch_min: float = Field(default=-90.0)
    gimbal_pitch_max: float = Field(default=30.0)
    max_speed_ms: float = Field(..., gt=0)
    max_altitude_m: float = Field(..., gt=0)


class DroneModelUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=256)
    manufacturer: str | None = Field(default=None, min_length=1, max_length=128)
    sensor_width_mm: float | None = Field(default=None, gt=0)
    sensor_height_mm: float | None = Field(default=None, gt=0)
    focal_length_mm: float | None = Field(default=None, gt=0)
    image_width_px: int | None = Field(default=None, gt=0)
    image_height_px: int | None = Field(default=None, gt=0)
    gimbal_pitch_min: float | None = None
    gimbal_pitch_max: float | None = None
    max_speed_ms: float | None = Field(default=None, gt=0)
    max_altitude_m: float | None = Field(default=None, gt=0)
