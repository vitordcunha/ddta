"""Pixel quality report + thumbnails for calibration (Fase 4).

Revision ID: 008_calibration_pixel_report
Revises: 007_calibration_images_exif
Create Date: 2026-04-24
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "008_calibration_pixel_report"
down_revision = "007_calibration_images_exif"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "calibration_sessions",
        sa.Column("pixel_report", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column(
        "calibration_images",
        sa.Column("thumbnail_storage_key", sa.String(length=1024), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("calibration_images", "thumbnail_storage_key")
    op.drop_column("calibration_sessions", "pixel_report")
