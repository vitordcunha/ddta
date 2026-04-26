"""Workspace map API keys (Mapbox, Google Maps)."""

import sqlalchemy as sa

from alembic import op

revision = "014_workspace_map_api_keys"
down_revision = "013_add_processing_preview_runs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "workspace_map_api_keys",
        sa.Column("workspace_id", sa.String(length=128), nullable=False),
        sa.Column("mapbox_api_key", sa.Text(), nullable=True),
        sa.Column("google_maps_api_key", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("workspace_id"),
    )


def downgrade() -> None:
    op.drop_table("workspace_map_api_keys")
