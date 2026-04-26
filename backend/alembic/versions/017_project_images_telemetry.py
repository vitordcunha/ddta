"""EXIF/XMP telemetry columns on project_images (Fase 11)."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "017_project_images_telemetry"
down_revision = "016_add_mini_5_pro_drone_model"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "project_images",
        sa.Column("relative_altitude", sa.Float(), nullable=True),
    )
    op.add_column(
        "project_images",
        sa.Column("gimbal_pitch", sa.Float(), nullable=True),
    )
    op.add_column(
        "project_images",
        sa.Column("flight_yaw", sa.Float(), nullable=True),
    )
    op.add_column(
        "project_images",
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("project_images", "captured_at")
    op.drop_column("project_images", "flight_yaw")
    op.drop_column("project_images", "gimbal_pitch")
    op.drop_column("project_images", "relative_altitude")
