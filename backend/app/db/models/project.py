from sqlalchemy import Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from geoalchemy2 import Geometry

from app.db.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Project(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "projects"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="draft", nullable=False)
    progress: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    altitude_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    forward_overlap: Mapped[int | None] = mapped_column(Integer, nullable=True)
    side_overlap: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rotation_angle: Mapped[float | None] = mapped_column(Float, nullable=True)
    flight_area = mapped_column(Geometry(geometry_type="POLYGON", srid=4326), nullable=True)
    planner_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    stats: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    assets: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    processing_task_uuid: Mapped[str | None] = mapped_column(String(100), nullable=True)
    odm_task_uuid: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Preview task tracking
    preview_task_uuid: Mapped[str | None] = mapped_column(String(100), nullable=True)
    preview_odm_task_uuid: Mapped[str | None] = mapped_column(String(100), nullable=True)
    preview_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    preview_progress: Mapped[int] = mapped_column(Integer, default=0)
    preview_assets: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    sparse_cloud_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    processing_runs: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    preview_runs: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    last_processing_preset: Mapped[str | None] = mapped_column(String(32), nullable=True)

    images = relationship("ProjectImage", back_populates="project", cascade="all, delete-orphan")
    calibration_sessions = relationship(
        "CalibrationSession",
        back_populates="project",
        cascade="all, delete-orphan",
    )
