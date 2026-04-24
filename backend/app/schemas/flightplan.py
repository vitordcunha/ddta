from __future__ import annotations

from pydantic import BaseModel, Field


class FlightPlanRequest(BaseModel):
    polygon_geojson: dict
    altitude_m: float = Field(..., gt=0)
    forward_overlap: float = Field(80, gt=0, lt=100)
    side_overlap: float = Field(70, gt=0, lt=100)
    rotation_angle: float = 0
    speed_ms: float = Field(8, gt=0)
    drone_model: str


class WaypointItem(BaseModel):
    order: int
    lon: float
    lat: float
    altitude_m: float


class FlightStatsResponse(BaseModel):
    area_m2: float
    distance_m: float
    estimated_duration_s: float
    strip_count: int
    waypoint_count: int


class WaypointResponse(BaseModel):
    waypoints: list[WaypointItem]
    waylines: list[list[WaypointItem]]
    stats: FlightStatsResponse
