from sqlalchemy import Boolean, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class DroneModelRow(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Modelo de drone parametrizado (padrão ou custom por workspace)."""

    __tablename__ = "drone_models"

    name: Mapped[str] = mapped_column(String(256), nullable=False)
    manufacturer: Mapped[str] = mapped_column(String(128), nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_custom: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    workspace_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)

    sensor_width_mm: Mapped[float] = mapped_column(Float, nullable=False)
    sensor_height_mm: Mapped[float] = mapped_column(Float, nullable=False)
    focal_length_mm: Mapped[float] = mapped_column(Float, nullable=False)
    image_width_px: Mapped[int] = mapped_column(Integer, nullable=False)
    image_height_px: Mapped[int] = mapped_column(Integer, nullable=False)

    fov_horizontal_deg: Mapped[float] = mapped_column(Float, nullable=False)
    fov_vertical_deg: Mapped[float] = mapped_column(Float, nullable=False)

    gimbal_pitch_min: Mapped[float] = mapped_column(Float, nullable=False, default=-90.0)
    gimbal_pitch_max: Mapped[float] = mapped_column(Float, nullable=False, default=30.0)

    max_speed_ms: Mapped[float] = mapped_column(Float, nullable=False)
    max_altitude_m: Mapped[float] = mapped_column(Float, nullable=False)
