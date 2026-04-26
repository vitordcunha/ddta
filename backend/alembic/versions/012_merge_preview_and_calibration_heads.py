"""Merge preview fields branch with calibration migrations (single Alembic head)."""

revision = "012_merge_preview_calib_heads"
down_revision = ("006_add_preview_fields", "011_calibration_small_thumbnail")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
