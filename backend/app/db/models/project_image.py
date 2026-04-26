from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class ProjectImage(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "project_images"

    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    has_gps: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lon: Mapped[float | None] = mapped_column(Float, nullable=True)
    relative_altitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    gimbal_pitch: Mapped[float | None] = mapped_column(Float, nullable=True)
    flight_yaw: Mapped[float | None] = mapped_column(Float, nullable=True)
    captured_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    project = relationship("Project", back_populates="images")
