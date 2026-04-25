from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class CalibrationImage(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "calibration_images"

    session_id: Mapped[UUID] = mapped_column(
        ForeignKey("calibration_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    storage_key: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    thumbnail_storage_key: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    small_thumbnail_storage_key: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    exif: Mapped[dict] = mapped_column(JSONB, nullable=False)
    primary_slot_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    is_primary_core: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    extras: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    is_best_for_slot: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    session = relationship("CalibrationSession", back_populates="images")
