from uuid import UUID

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class CalibrationSession(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "calibration_sessions"

    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    params_snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False)
    polygon_snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)
    exif_report: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    pixel_report: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    theoretical_grid: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    project = relationship("Project", back_populates="calibration_sessions")
    images = relationship(
        "CalibrationImage",
        back_populates="session",
        cascade="all, delete-orphan",
    )
