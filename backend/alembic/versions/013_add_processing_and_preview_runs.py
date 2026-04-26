"""Add processing_runs, preview_runs, last_processing_preset to projects."""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "013_add_processing_preview_runs"
down_revision = "012_merge_preview_calib_heads"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("processing_runs", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column(
        "projects",
        sa.Column("preview_runs", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column("projects", sa.Column("last_processing_preset", sa.String(32), nullable=True))


def downgrade() -> None:
    op.drop_column("projects", "last_processing_preset")
    op.drop_column("projects", "preview_runs")
    op.drop_column("projects", "processing_runs")
