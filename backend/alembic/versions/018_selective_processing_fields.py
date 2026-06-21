"""Add selective_processing_preset and processing_boundary to projects."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "018_selective_processing_fields"
down_revision = "017_project_images_telemetry"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("selective_processing_preset", sa.String(32), nullable=True),
    )
    op.add_column(
        "projects",
        sa.Column("processing_boundary", JSONB(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("projects", "processing_boundary")
    op.drop_column("projects", "selective_processing_preset")
