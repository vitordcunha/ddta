"""Add small_thumbnail_storage_key to calibration_images (Fase 3-A / 5)."""

import sqlalchemy as sa
from alembic import op

revision = "011_calibration_small_thumbnail"
down_revision = "010_calib_img_extras"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "calibration_images",
        sa.Column("small_thumbnail_storage_key", sa.String(1024), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("calibration_images", "small_thumbnail_storage_key")
