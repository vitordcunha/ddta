"""Theoretical calibration grid + primary slot per image (Fases 2–3).

Revision ID: 009_calibration_theoretical_grid
Revises: 008_calibration_pixel_report
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "009_calibration_theoretical_grid"
down_revision = "008_calibration_pixel_report"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("calibration_sessions", sa.Column("theoretical_grid", JSONB, nullable=True))
    op.add_column("calibration_images", sa.Column("primary_slot_id", sa.String(40), nullable=True))
    op.add_column("calibration_images", sa.Column("is_primary_core", sa.Boolean(), nullable=True))


def downgrade() -> None:
    op.drop_column("calibration_images", "is_primary_core")
    op.drop_column("calibration_images", "primary_slot_id")
    op.drop_column("calibration_sessions", "theoretical_grid")
