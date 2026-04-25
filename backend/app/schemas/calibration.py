from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CalibrationSessionCreate(BaseModel):
    """Snapshot enviado pelo planejador ao criar a sessão."""

    params_snapshot: dict = Field(..., description="Parâmetros de voo (JSON compatível com o frontend).")
    polygon_snapshot: dict = Field(..., description="Polígono de calibração (GeoJSON Feature Polygon).")


class CalibrationSessionStartResponse(BaseModel):
    session_id: UUID
    upload_url: str
    theoretical_grid: dict[str, Any] | None = Field(
        default=None,
        description="Grade teórica de slots (centróide + footprint) gerada na criação da sessão.",
    )


class CalibrationSessionListItem(BaseModel):
    id: UUID
    project_id: UUID
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CalibrationMetricItem(BaseModel):
    id: str
    title: str
    severity: str
    detail: str
    value: float | str | None = None


class CalibrationParamChange(BaseModel):
    """Sugestão aplicável aos parâmetros do planejador (FlightParams)."""

    field: str
    suggested: float | int
    current: float | int | None = None
    hint: str | None = None


class CalibrationRecommendation(BaseModel):
    """Regra determinística + justificativa curta (Fase 5)."""

    id: str
    kind: str
    severity: str
    rationale: str
    text: str
    param_changes: list[CalibrationParamChange] = Field(default_factory=list)
    affected_slots: list[str] = Field(
        default_factory=list,
        description="IDs dos slots do grid relacionados a esta recomendação (para destaque no mapa).",
    )


class CalibrationExifReport(BaseModel):
    version: int = 1
    summary: dict[str, Any] = Field(default_factory=dict)
    metrics: list[CalibrationMetricItem] = Field(default_factory=list)
    error: str | None = None


class CalibrationImageSummary(BaseModel):
    """Metadados leves para mapa / painel (sem bytes de miniatura)."""

    id: UUID
    filename: str
    primary_slot_id: str | None = None
    is_best_for_slot: bool | None = None
    exif: dict[str, Any] = Field(default_factory=dict)
    extras: dict[str, Any] = Field(default_factory=dict)


class CalibrationSessionDetail(BaseModel):
    id: UUID
    project_id: UUID
    status: str
    created_at: datetime
    updated_at: datetime
    polygon_snapshot: dict[str, Any] | None = Field(
        default=None,
        description="GeoJSON da área de calibração (para vista standalone / mapa).",
    )
    exif_report: dict[str, Any] | None = None
    pixel_report: dict[str, Any] | None = None
    theoretical_grid: dict[str, Any] | None = None
    recommendations: list[CalibrationRecommendation] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class CalibrationSessionFullReport(BaseModel):
    """EXIF + pixel + recomendações (Fases 4–5)."""

    session_id: UUID
    status: str
    polygon_snapshot: dict[str, Any] | None = None
    exif_report: dict[str, Any] | None = None
    pixel_report: dict[str, Any] | None = None
    theoretical_grid: dict[str, Any] | None = None
    recommendations: list[CalibrationRecommendation] = Field(default_factory=list)


class CalibrationUploadResponse(BaseModel):
    session_id: UUID
    accepted: int
    status: str
    store_original: bool
    message: str | None = None
