"""Calibration image extras + is_best_for_slot (Fase 4 / 3-A)."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# ID ≤ 32 chars (Postgres default alembic_version.version_num).
revision = "010_calib_img_extras"
down_revision = "009_calibration_theoretical_grid"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "calibration_images",
        sa.Column("extras", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
    )
    op.add_column("calibration_images", sa.Column("is_best_for_slot", sa.Boolean(), nullable=True))


def downgrade() -> None:
    op.drop_column("calibration_images", "is_best_for_slot")
    op.drop_column("calibration_images", "extras")
